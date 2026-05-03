import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import * as api from '../api'

export default function Tournaments() {
  const { id } = useParams()
  const [tournaments, setTournaments] = useState([])
  const [selectedTournament, setSelectedTournament] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadTournaments()
  }, [])

  useEffect(() => {
    if (id) {
      loadTournament(id)
    } else {
      setSelectedTournament(null)
    }
  }, [id])

  async function loadTournaments() {
    try {
      const data = await api.getTournaments()
      setTournaments([...data].sort((a, b) => a.description.localeCompare(b.description)))
      console.log('[TOURNAMENTS] Loaded tournaments')
    } catch (err) {
      console.error('[TOURNAMENTS] Error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadTournament(tournamentId) {
    try {
      const data = await api.getTournament(tournamentId)
      setSelectedTournament(data)
      console.log('[TOURNAMENTS] Loaded tournament:', data.description)
    } catch (err) {
      console.error('[TOURNAMENTS] Error:', err)
      setError(err.message)
    }
  }

  if (loading) return <div className="text-center py-8">Cargando...</div>

  // Show tournament detail if selected
  if (selectedTournament) {
    return (
      <div className="max-w-4xl mx-auto">
        <Link to="/" className="text-red-400 hover:text-red-300 mb-4 inline-block">
          &larr; Volver a categorías
        </Link>

        <div className="flex justify-between items-center mb-2">
          <h1 className="text-3xl font-bold">{selectedTournament.description}</h1>
          <Link
            to={`/tournament/${selectedTournament.id}/evolution`}
            className="btn btn-secondary text-sm"
          >
            Evolución de Posiciones
          </Link>
        </div>

        {selectedTournament.subscribedToId && (
          <p className="text-yellow-500 mb-4">
            Suscrito a: {selectedTournament.subscribedTo?.description}
          </p>
        )}

        {error && (
          <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Gameweeks List */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Fechas ({selectedTournament.gameweeks.length})</h2>

          {selectedTournament.gameweeks.length === 0 ? (
            <p className="text-gray-400">No hay fechas creadas</p>
          ) : (
            <div className="space-y-2">
              {selectedTournament.gameweeks.map((gw) => (
                <div key={gw.id} className="flex justify-between items-center p-3 bg-gray-700 rounded">
                  <Link
                    to={`/gameweek/${gw.id}`}
                    className="flex-1 hover:text-red-400"
                  >
                    <span className="font-medium">{gw.description}</span>
                    <span className="text-sm text-gray-400 ml-3">
                      {gw._count.matches} partidos
                    </span>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Show tournaments list
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Categorías</h1>

      {error && (
        <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {tournaments.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-gray-400">No hay torneos disponibles</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tournaments.map(t => (
            <div key={t.id} className="card">
              <Link
                to={`/tournament/${t.id}`}
                className="block hover:text-red-400"
              >
                <h3 className="font-bold text-lg">{t.description}</h3>
                <p className="text-sm text-gray-400">
                  {t._count.gameweeks} fechas
                  {t.subscribedTo && (
                    <span className="ml-2 text-yellow-500">
                      (suscrito a {t.subscribedTo.description})
                    </span>
                  )}
                </p>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
