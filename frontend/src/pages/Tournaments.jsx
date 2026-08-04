import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import * as api from '../api'

export default function Tournaments() {
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadTournaments()
  }, [])

  async function loadTournaments() {
    try {
      const data = await api.getTournaments()
      setTournaments(data)
      console.log('[TOURNAMENTS] Loaded tournaments')
    } catch (err) {
      console.error('[TOURNAMENTS] Error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleArchive(id, name, archived) {
    const action = archived ? 'Archivar' : 'Desarchivar'
    if (!confirm(`${action} torneo "${name}"? ${archived ? 'Dejara de verse en la web publica.' : 'Volvera a verse en la web publica.'}`)) return

    try {
      await api.setTournamentArchived(id, archived)
      console.log(`[TOURNAMENTS] Tournament ${id} archived=${archived}`)
      loadTournaments()
    } catch (err) {
      console.error('[TOURNAMENTS] Error archiving:', err)
      setError(err.message)
    }
  }

  async function handleDelete(id, name) {
    if (!confirm(`Eliminar torneo "${name}"? Esto eliminara todas las fechas y predicciones.`)) return

    try {
      await api.deleteTournament(id)
      loadTournaments()
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <div className="text-center py-8">Cargando...</div>

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Torneos</h1>
        <Link to="/" className="btn btn-primary">Nuevo Torneo</Link>
      </div>

      {error && (
        <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {tournaments.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-gray-400 mb-4">No hay torneos creados</p>
          <Link to="/" className="btn btn-primary">Crear primer torneo</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {tournaments.map(t => (
            <div
              key={t.id}
              className={`card flex justify-between items-center ${t.archived ? '!bg-amber-900/40 border border-amber-700' : ''}`}
            >
              <Link
                to={`/tournament/${t.id}`}
                className="flex-1 hover:text-blue-400"
              >
                <h3 className="font-bold text-lg">
                  {t.description}
                  {t.archived && (
                    <span className="ml-2 text-xs font-normal bg-amber-700 text-amber-100 px-2 py-0.5 rounded align-middle">
                      ARCHIVADO
                    </span>
                  )}
                </h3>
                <p className="text-sm text-gray-400">
                  {t._count.gameweeks} fechas
                  {t.subscribedTo && (
                    <span className="ml-2 text-yellow-500">
                      (suscrito a {t.subscribedTo.description})
                    </span>
                  )}
                </p>
              </Link>
              <button
                onClick={() => handleToggleArchive(t.id, t.description, !t.archived)}
                className="btn btn-secondary ml-4"
              >
                {t.archived ? 'Desarchivar' : 'Archivar'}
              </button>
              <button
                onClick={() => handleDelete(t.id, t.description)}
                className="btn btn-danger ml-2"
              >
                Eliminar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
