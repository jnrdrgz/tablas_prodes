import { useState } from 'react'
import * as api from '../api'

// Our short names that don't look like ESPN's names. Add more here if auto-link misses them.
const TEAM_ALIASES = {
  'central cba': 'central cordoba',
  'gimnasia mza': 'gimnasia mendoza',
  'estudiantes rc': 'estudiantes rio cuarto',
  'estudiantes lp': 'estudiantes la plata',
  'gimnasia lp': 'gimnasia la plata',
  'ind rivadavia': 'independiente rivadavia',
  'atl tucuman': 'atletico tucuman',
}

const MIN_SCORE_TO_SUGGEST = 1.2
const AMBIGUOUS_MARGIN = 0.2

function normalize(text) {
  return (text || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// 0..1 how well our team name matches an ESPN team
function teamScore(ourName, espnTeam) {
  const ours = normalize(ourName)
  const ourTokens = (TEAM_ALIASES[ours] || ours).split(' ').filter(Boolean)
  const espnTokens = normalize(`${espnTeam.name} ${espnTeam.shortName}`).split(' ').filter(Boolean)
  if (ourTokens.length === 0) return 0

  let total = 0
  for (const token of ourTokens) {
    if (espnTokens.includes(token)) total += 1
    else if (token.length >= 3 && espnTokens.some(t => t.startsWith(token))) total += 0.8
  }
  return total / ourTokens.length
}

function eventScore(matchDescription, event) {
  const parts = matchDescription.split(' - ').map(s => s.trim())
  if (parts.length !== 2) return 0
  const [home, away] = parts
  const straight = teamScore(home, event.home) + teamScore(away, event.away)
  const swapped = (teamScore(home, event.away) + teamScore(away, event.home)) * 0.9
  return Math.max(straight, swapped)
}

// Greedy: best pairs first, an ESPN event can only be used once
function suggestLinks(matches, events) {
  const candidates = []
  for (const match of matches) {
    const scores = events.map(e => ({ event: e, score: eventScore(match.description, e) })).sort((a, b) => b.score - a.score)
    const [best, second] = scores
    if (!best || best.score < MIN_SCORE_TO_SUGGEST) continue
    const ambiguous = second && best.score - second.score < AMBIGUOUS_MARGIN
    candidates.push({ matchId: match.id, event: best.event, score: best.score, ambiguous })
  }
  candidates.sort((a, b) => b.score - a.score)

  const usedEvents = new Set()
  const suggestions = {}
  for (const c of candidates) {
    if (usedEvents.has(c.event.id)) {
      suggestions[c.matchId] = { eventId: '', state: 'review' }
      continue
    }
    usedEvents.add(c.event.id)
    suggestions[c.matchId] = { eventId: c.event.id, state: c.ambiguous ? 'review' : 'auto' }
  }
  return suggestions
}

function formatKickoff(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function isoDay(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

export default function EspnLinker({ gameweek, onSaved }) {
  const today = new Date()
  const [from, setFrom] = useState(isoDay(today))
  const [to, setTo] = useState(isoDay(new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)))
  const [events, setEvents] = useState([])
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  // matchId -> { eventId: string ('' = no link), state: 'saved' | 'auto' | 'review' | 'manual' }
  const [selection, setSelection] = useState(() => {
    const initial = {}
    for (const m of gameweek.matches) {
      initial[m.id] = { eventId: m.espnEventId || '', state: m.espnEventId ? 'saved' : 'manual' }
    }
    return initial
  })

  async function handleSearch() {
    setSearching(true)
    setError('')
    setMessage('')
    console.log(`[ESPN-LINKER] Searching ESPN events ${from} -> ${to}`)
    try {
      const data = await api.getEspnScoreboard(from, to)
      setEvents(data.events)
      if (data.errors.length > 0) setError(`Algunos dias fallaron: ${data.errors.join(', ')}`)
      setMessage(`${data.events.length} partidos encontrados en ESPN`)
      console.log(`[ESPN-LINKER] Found ${data.events.length} events`)
    } catch (err) {
      console.error('[ESPN-LINKER] Search error:', err)
      setError(err.message)
    } finally {
      setSearching(false)
    }
  }

  function handleAutoLink() {
    const suggestions = suggestLinks(gameweek.matches, events)
    const next = { ...selection }
    let linked = 0
    for (const match of gameweek.matches) {
      const s = suggestions[match.id]
      if (s) {
        next[match.id] = s
        if (s.eventId) linked++
      } else if (!next[match.id].eventId) {
        next[match.id] = { eventId: '', state: 'review' }
      }
    }
    setSelection(next)
    setMessage(`Auto-vinculados ${linked} de ${gameweek.matches.length}. Revisar los marcados.`)
    console.log(`[ESPN-LINKER] Auto-linked ${linked}/${gameweek.matches.length}`)
  }

  function handleSelect(matchId, eventId) {
    setSelection(prev => ({ ...prev, [matchId]: { eventId, state: 'manual' } }))
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    setMessage('')
    const eventsById = new Map(events.map(e => [e.id, e]))
    const links = gameweek.matches.map(match => {
      const eventId = selection[match.id].eventId
      if (!eventId) return { matchId: match.id, espnEventId: null, espnDate: null }
      // keep the saved date if the event wasn't in this search
      const espnDate = eventsById.get(eventId)?.espnDate || (match.espnEventId === eventId ? match.espnDate : null)
      return { matchId: match.id, espnEventId: eventId, espnDate }
    })

    const brokenLink = links.find(l => l.espnEventId && !l.espnDate)
    if (brokenLink) {
      setError('Hay un vinculo sin fecha de ESPN, volver a buscar partidos')
      setSaving(false)
      return
    }

    console.log('[ESPN-LINKER] Saving links:', links)
    try {
      const result = await api.saveEspnLinks(gameweek.id, links)
      setMessage(`Vinculos guardados (${result.updated} partidos, incluye torneos suscritos)`)
      console.log(`[ESPN-LINKER] Saved, ${result.updated} rows updated`)
      onSaved?.()
    } catch (err) {
      console.error('[ESPN-LINKER] Save error:', err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const stateLabel = {
    saved: <span className="text-green-400">✔ guardado</span>,
    auto: <span className="text-green-400">✔ auto</span>,
    review: <span className="text-yellow-400">⚠ revisar</span>,
    manual: <span className="text-gray-400">manual</span>,
  }

  return (
    <div className="card mb-4">
      <h3 className="font-bold mb-1">Vincular con ESPN (Liga Profesional)</h3>
      <p className="text-sm text-gray-400 mb-3">
        Buscar los dias de la fecha, auto-vincular y corregir a mano. Se copia a los torneos suscritos.
        El resultado final NO se carga solo: ESPN se muestra en vivo hasta que cargues el resultado real.
      </p>

      <div className="flex flex-wrap items-end gap-3 mb-3">
        <div>
          <label className="text-xs text-gray-400 block">Desde</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="input" />
        </div>
        <div>
          <label className="text-xs text-gray-400 block">Hasta</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="input" />
        </div>
        <button onClick={handleSearch} disabled={searching} className="btn btn-primary">
          {searching ? 'Buscando...' : 'Buscar partidos ESPN'}
        </button>
        <button onClick={handleAutoLink} disabled={events.length === 0} className="btn btn-secondary disabled:opacity-50">
          Auto-vincular
        </button>
      </div>

      {message && <p className="text-sm text-green-400 mb-2">{message}</p>}
      {error && <p className="text-sm text-red-400 mb-2">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-3 py-2 text-left">Partido nuestro</th>
              <th className="px-3 py-2 text-left">Partido ESPN</th>
              <th className="px-3 py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {gameweek.matches.map(match => {
              const current = selection[match.id]
              const savedNotInList = match.espnEventId && !events.some(e => e.id === match.espnEventId)
              return (
                <tr key={match.id} className={`border-t border-gray-700 ${current.state === 'review' ? 'bg-yellow-900/30' : ''}`}>
                  <td className="px-3 py-2">{match.description}</td>
                  <td className="px-3 py-2">
                    <select
                      value={current.eventId}
                      onChange={e => handleSelect(match.id, e.target.value)}
                      className="w-full px-2 py-1 bg-gray-900 border border-gray-600 rounded"
                    >
                      <option value="">— no vincular —</option>
                      {savedNotInList && (
                        <option value={match.espnEventId}>Vinculado (evento {match.espnEventId})</option>
                      )}
                      {events.map(ev => (
                        <option key={ev.id} value={ev.id}>
                          {ev.home.name} vs {ev.away.name} · {formatKickoff(ev.kickoff)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-center">{stateLabel[current.state]}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end mt-3">
        <button onClick={handleSave} disabled={saving} className="btn btn-success">
          {saving ? 'Guardando...' : 'Guardar vinculos'}
        </button>
      </div>
    </div>
  )
}
