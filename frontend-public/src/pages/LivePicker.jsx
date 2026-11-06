import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import * as api from '../api'

const REFRESH_MS = 60000

function formatKickoff(iso) {
  return new Date(iso).toLocaleString('es-AR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function LivePicker() {
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, REFRESH_MS)
    return () => clearInterval(interval)
  }, [])

  async function loadData() {
    try {
      const data = await api.getLiveTournaments()
      setTournaments(data.tournaments)
      setError('')
      console.log(`[LIVE PICKER] Loaded ${data.tournaments.length} tournaments`)
    } catch (err) {
      console.error('[LIVE PICKER] Error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="text-center py-8">Cargando...</div>

  const inPlayCount = Math.max(0, ...tournaments.map(t => t.inPlayCount))
  const gameweekName = tournaments[0]?.gameweek?.description

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-4xl font-bebas tracking-wider mb-1">En Vivo</h1>
      <p className="text-gray-400 mb-6">
        {gameweekName && <>{gameweekName} · </>}
        {inPlayCount > 0 ? `${inPlayCount} partidos jugándose ahora` : 'No hay partidos en juego'}
      </p>

      {error && (
        <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded mb-4">{error}</div>
      )}

      {tournaments.length === 0 ? (
        <div className="card text-center py-8 text-gray-400">No hay categorías activas</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {tournaments.map(t => (
            <Link
              key={t.id}
              to={`/en-vivo/${t.id}`}
              className="card text-left hover:ring-2 hover:ring-brand-600 transition"
            >
              <div className="flex justify-between items-center gap-2">
                <span className="font-bebas text-3xl tracking-wider">{t.description}</span>
                {t.inPlayCount > 0 ? (
                  <span className="text-xs bg-brand-600 px-2 py-1 rounded flex items-center gap-1 whitespace-nowrap">
                    <span className="h-1.5 w-1.5 bg-white rounded-full animate-pulse"></span>
                    EN VIVO · {t.inPlayCount}
                  </span>
                ) : t.nextKickoff ? (
                  <span className="text-xs bg-gray-600 px-2 py-1 rounded whitespace-nowrap">PRÓXIMO {formatKickoff(t.nextKickoff)}</span>
                ) : null}
              </div>
              <p className="text-sm text-gray-400 mt-2">
                {t.participantCount} participantes
                {t.leader && (
                  <> · Puntero: <b className="text-white">{t.leader.predictor}</b>
                    {t.leader.provisionalPoints > 0 && <span className="text-green-400"> (+{t.leader.provisionalPoints} en vivo)</span>}
                  </>
                )}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
