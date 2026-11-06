import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import * as api from '../api'

const REFRESH_MS = 60000
const MAX_HIT_NAMES = 4

// order of the match cards: in play first, then finished, then upcoming, then without ESPN data
const STATUS_ORDER = { live: 0, halftime: 1, espn_final: 2, result: 3, scheduled: 4, pending: 5, nolink: 6 }

const isInPlay = m => m.displayStatus === 'live' || m.displayStatus === 'halftime'

function splitTeams(description) {
  const parts = description.split(' - ').map(s => s.trim())
  return parts.length === 2 ? parts : [description, '']
}

function shortName(description) {
  const [home, away] = splitTeams(description)
  return `${home.substring(0, 3).toUpperCase()}-${away.substring(0, 3).toUpperCase()}`
}

function formatKickoff(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('es-AR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
}

function formatTime(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function cellClass(status, result) {
  if (result === '9-9') return 'bg-gray-600 text-gray-400'
  if (status === 'exact') return 'bg-green-700'
  if (status === 'winner') return 'bg-yellow-600'
  return ''
}

function StatusBadge({ match }) {
  switch (match.displayStatus) {
    case 'live':
      return (
        <span className="text-brand-400 font-bold flex items-center gap-1">
          <span className="h-1.5 w-1.5 bg-brand-600 rounded-full animate-pulse"></span>
          {match.espn.clock || 'EN VIVO'}
        </span>
      )
    case 'halftime':
      return <span className="text-yellow-400 font-bold">ENTRETIEMPO</span>
    case 'espn_final':
      return <span className="text-gray-300 font-bold">FINAL <span className="font-normal text-gray-400">(ESPN, resultado sin cargar)</span></span>
    case 'result':
      return <span className="text-gray-300 font-bold">FINAL</span>
    case 'pending':
      return <span className="text-gray-400">esperando datos de ESPN</span>
    default:
      return null
  }
}

function MatchCard({ match }) {
  const [home, away] = splitTeams(match.description)

  if (match.displayStatus === 'nolink') {
    return (
      <div className="card py-3 opacity-60 border border-dashed border-gray-600">
        <div className="flex items-center justify-between gap-2">
          <span className="flex-1">{home}</span>
          <span className="text-xs text-gray-400 text-center">sin datos en vivo</span>
          <span className="flex-1 text-right">{away}</span>
        </div>
      </div>
    )
  }

  if (match.displayStatus === 'scheduled') {
    return (
      <div className="card py-3 opacity-60">
        <div className="flex items-center justify-between gap-2">
          <span className="flex-1">{home}</span>
          <span className="text-xs text-gray-400 text-center">{formatKickoff(match.espn?.kickoff)}</span>
          <span className="flex-1 text-right">{away}</span>
        </div>
      </div>
    )
  }

  const score = match.effectiveResult ? match.effectiveResult.replace('-', ' - ') : '- : -'
  const details = match.espn?.details || []
  const describe = d => `${d.kind === 'goal' ? '⚽' : '🟥'} ${d.player} ${d.minute}${d.penalty ? ' (P)' : ''}${d.ownGoal ? ' (EC)' : ''}`
  const homeDetails = details.filter(d => d.side === 'home')
  const awayDetails = details.filter(d => d.side === 'away')

  const hits = match.predictions
    .filter(p => p.status === 'exact' || p.status === 'winner')
    .sort((a, b) => (a.status === 'exact' ? 0 : 1) - (b.status === 'exact' ? 0 : 1))

  return (
    <div className={`card ${match.displayStatus === 'result' || match.displayStatus === 'espn_final' ? 'opacity-80' : ''}`}>
      <div className="flex justify-between text-xs mb-1"><StatusBadge match={match} /></div>
      <div className="flex items-center justify-between text-lg">
        <span className="flex-1">{home}</span>
        <span className="font-bebas text-3xl px-3 whitespace-nowrap">{score}</span>
        <span className="flex-1 text-right">{away}</span>
      </div>

      {details.length > 0 && (
        <div className="text-xs text-gray-400 mt-2 grid grid-cols-2 gap-1">
          <div>{homeDetails.map((d, i) => <div key={i}>{describe(d)}</div>)}</div>
          <div className="text-right">{awayDetails.map((d, i) => <div key={i}>{describe(d)}</div>)}</div>
        </div>
      )}

      {isInPlay(match) && (
        <div className="mt-3 pt-2 border-t border-gray-700 text-xs flex flex-wrap gap-1 items-center">
          <span className="text-gray-400 mr-1">Aciertan {hits.length}/{match.predictions.length}:</span>
          {hits.length === 0 && <span className="text-gray-500">nadie</span>}
          {hits.slice(0, MAX_HIT_NAMES).map(h => (
            <span key={h.predictor} className={`${h.status === 'exact' ? 'bg-green-700' : 'bg-yellow-600'} px-1.5 rounded`}>
              {h.predictor} {h.result}
            </span>
          ))}
          {hits.length > MAX_HIT_NAMES && <span className="text-gray-500">+{hits.length - MAX_HIT_NAMES} más</span>}
        </div>
      )}
    </div>
  )
}

function PositionChange({ value }) {
  if (value > 0) return <span className="text-green-400">▲{value}</span>
  if (value < 0) return <span className="text-red-400">▼{-value}</span>
  return <span className="text-gray-500">=</span>
}

// same zone colors as the gameweek page: tournament.settings.greenCount / redCount
function LiveTable({ standings, settings }) {
  const greenCount = settings?.greenCount ?? 1
  const redCount = settings?.redCount ?? 2
  const rowClass = index => {
    if (index < greenCount) return 'bg-green-900'
    if (index >= standings.length - redCount) return 'bg-red-900'
    return ''
  }

  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead className="bg-gray-700">
          <tr>
            <th className="px-2 py-2">#</th>
            <th className="px-2 py-2"></th>
            <th className="px-2 py-2 text-left">Jugador</th>
            <th className="px-2 py-2" title="Puntos en esta fecha (incluye ESPN)">Fecha</th>
            <th className="px-2 py-2">Plenos</th>
            <th className="px-2 py-2" title="Goles de los plenos (desempate)">Goles</th>
            <th className="px-2 py-2">Total</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row, i) => (
            <tr key={row.predictor} className={`border-t border-gray-700 ${rowClass(i)}`}>
              <td className="px-2 py-1.5 text-center font-bold">{row.position}</td>
              <td className="px-2 py-1.5 text-center text-xs"><PositionChange value={row.positionChange} /></td>
              <td className="px-2 py-1.5">{row.predictor}</td>
              <td className="px-2 py-1.5 text-center">
                {row.gameweekPoints}
                {row.provisionalPoints > 0 && <span className="text-green-400 text-xs"> (+{row.provisionalPoints})</span>}
              </td>
              <td className="px-2 py-1.5 text-center">{row.gameweekPlenos}</td>
              <td className="px-2 py-1.5 text-center">{row.gameweekGoles}</td>
              <td className="px-2 py-1.5 text-center font-bold text-base">{row.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PredictionsGrid({ matches, standings }) {
  const predictionLookup = {}
  for (const match of matches) {
    for (const p of match.predictions) predictionLookup[`${match.id}|${p.predictor}`] = p
  }

  const headerSub = match => {
    if (match.displayStatus === 'result') return <span className="text-gray-300">{match.effectiveResult} · F</span>
    if (match.displayStatus === 'espn_final') return <span className="text-gray-300">{match.effectiveResult} · F*</span>
    if (match.displayStatus === 'live') return <span className="text-brand-400">{match.effectiveResult} · {match.espn.clock}</span>
    if (match.displayStatus === 'halftime') return <span className="text-yellow-400">{match.effectiveResult} · ET</span>
    if (match.displayStatus === 'scheduled') return <span className="text-gray-500">{formatKickoff(match.espn?.kickoff)}</span>
    return <span className="text-gray-500">-</span>
  }

  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full text-xs whitespace-nowrap">
        <thead className="bg-gray-700">
          <tr>
            <th className="px-2 py-2 text-left sticky left-0 bg-gray-700 z-10">Jugador</th>
            {matches.map(m => (
              <th
                key={m.id}
                title={m.description}
                className="px-2 py-2 text-center"
                style={isInPlay(m) ? { boxShadow: 'inset 0 2px 0 #da020f' } : undefined}
              >
                {shortName(m.description)}<br />{headerSub(m)}
              </th>
            ))}
            <th className="px-2 py-2">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map(row => (
            <tr key={row.predictor}>
              <td className="px-2 py-1 border border-gray-700 sticky left-0 bg-gray-800 z-10">{row.predictor}</td>
              {matches.map(m => {
                const p = predictionLookup[`${m.id}|${row.predictor}`]
                return (
                  <td key={m.id} className={`px-2 py-1 border border-gray-700 text-center ${p ? cellClass(p.status, p.result) : ''}`}>
                    {p ? p.result : ''}
                  </td>
                )
              })}
              <td className="px-2 py-1 border border-gray-700 text-center font-bold">{row.gameweekPoints}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function LiveTournament() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mobileTab, setMobileTab] = useState('matches')

  useEffect(() => {
    setLoading(true)
    loadData()
    const interval = setInterval(loadData, REFRESH_MS)
    return () => clearInterval(interval)
  }, [id])

  async function loadData() {
    try {
      const result = await api.getLiveTournament(id)
      setData(result)
      setError('')
      console.log(`[LIVE] Loaded tournament ${id}: ${result.matches.length} matches, ${result.standings.length} predictors`)
    } catch (err) {
      // keep showing the last data we had, just show the error on top
      console.error('[LIVE] Error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading && !data) return <div className="text-center py-8">Cargando...</div>
  if (!data) return <div className="text-center py-8 text-red-400">{error || 'Sin datos'}</div>

  const matches = [...data.matches].sort((a, b) => {
    const byStatus = STATUS_ORDER[a.displayStatus] - STATUS_ORDER[b.displayStatus]
    if (byStatus !== 0) return byStatus
    return (a.espn?.kickoff || '').localeCompare(b.espn?.kickoff || '')
  })
  const tabClass = active => `px-3 py-2 ${active ? 'bg-brand-600' : ''}`

  return (
    <div className="max-w-7xl mx-auto pb-12">
      <Link to="/en-vivo" className="text-red-400 hover:text-red-300 mb-3 inline-block">&larr; Volver a categorías</Link>

      <div className="flex flex-wrap justify-between items-end gap-2 mb-4">
        <div>
          <h1 className="text-4xl font-bebas tracking-wider">{data.tournament.description}</h1>
          <p className="text-gray-400 text-sm">
            {data.gameweek ? `${data.gameweek.description} · ${data.matches.length} partidos · ${data.standings.length} participantes · ` : ''}
            ESPN actualizado {formatTime(data.status.lastFetchAt)}
          </p>
        </div>
        <div className="flex lg:hidden bg-gray-800 rounded overflow-hidden text-sm">
          <button onClick={() => setMobileTab('matches')} className={tabClass(mobileTab === 'matches')}>Partidos</button>
          <button onClick={() => setMobileTab('table')} className={tabClass(mobileTab === 'table')}>Tabla</button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded mb-4">{error}</div>
      )}

      {!data.gameweek ? (
        <div className="card text-center py-8 text-gray-400">Todavía no hay fechas en esta categoría</div>
      ) : (
        <>
          <div className="grid lg:grid-cols-5 gap-4">
            <div className={`lg:col-span-2 ${mobileTab === 'matches' ? '' : 'hidden'} lg:block`}>
              <h2 className="font-bebas text-2xl tracking-wider mb-3">Partidos</h2>
              <div className="space-y-3">
                {matches.map(m => <MatchCard key={m.id} match={m} />)}
              </div>
            </div>

            <div className={`lg:col-span-3 ${mobileTab === 'table' ? '' : 'hidden'} lg:block`}>
              <h2 className="font-bebas text-2xl tracking-wider mb-3">Tabla en vivo</h2>
              <LiveTable standings={data.standings} settings={data.tournament.settings} />
              <p className="text-xs text-gray-400 mt-2">
                Puntos provisorios: los partidos sin resultado cargado cuentan con el marcador de ESPN.
                <span className="text-green-400"> (+n)</span> = puntos que vienen de ESPN.
                ▲▼ = cambio de posición por esos puntos.
              </p>
            </div>
          </div>

          <h2 className="font-bebas text-2xl tracking-wider mt-6 mb-3">Pronósticos</h2>
          <PredictionsGrid matches={data.matches} standings={data.standings} />
          <p className="text-xs text-gray-400 mt-2">
            Verde = pleno, amarillo = ganador. Línea roja arriba = partido en curso. F* = final de ESPN, falta cargar el resultado.
          </p>
        </>
      )}
    </div>
  )
}
