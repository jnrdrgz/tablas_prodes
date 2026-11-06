import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import * as api from '../api'

export default function Home() {
  const [tournaments, setTournaments] = useState([])
  const [mappings, setMappings] = useState([])
  const [newTournament, setNewTournament] = useState('')
  const [subscribedTo, setSubscribedTo] = useState('')
  const [newMappingKey, setNewMappingKey] = useState('')
  const [newMappingValue, setNewMappingValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      const [tournamentsData, mappingsData] = await Promise.all([
        api.getTournaments(),
        api.getMappings()
      ])
      setTournaments(tournamentsData)
      setMappings(mappingsData)
      console.log('[HOME] Loaded tournaments and mappings')
    } catch (err) {
      console.error('[HOME] Error loading data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateTournament(e) {
    e.preventDefault()
    if (!newTournament.trim()) return

    try {
      await api.createTournament({
        description: newTournament,
        subscribedToId: subscribedTo || null
      })
      setNewTournament('')
      setSubscribedTo('')
      loadData()
      console.log('[HOME] Tournament created')
    } catch (err) {
      console.error('[HOME] Error creating tournament:', err)
      setError(err.message)
    }
  }

  async function handleCreateMapping(e) {
    e.preventDefault()
    if (!newMappingKey.trim() || !newMappingValue.trim()) return

    try {
      const result = await api.createMapping(newMappingKey, newMappingValue)
      setNewMappingKey('')
      setNewMappingValue('')
      loadData()
      console.log('[HOME] Mapping created, predictions updated:', result.predictionsUpdated)
      if (result.predictionsUpdated > 0) {
        alert(`Mapeo creado. ${result.predictionsUpdated} predicciones actualizadas.`)
      }
    } catch (err) {
      console.error('[HOME] Error creating mapping:', err)
      setError(err.message)
    }
  }

  async function handleDeleteMapping(id) {
    if (!confirm('Eliminar este mapeo?')) return
    try {
      await api.deleteMapping(id)
      loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <div className="text-center py-8">Cargando...</div>

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Prodes</h1>

      {error && (
        <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded mb-4">
          {error}
          <button onClick={() => setError('')} className="float-right">&times;</button>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* New Tournament */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Nuevo Torneo</h2>
          <form onSubmit={handleCreateTournament} className="space-y-3">
            <input
              type="text"
              placeholder="Nombre del torneo"
              value={newTournament}
              onChange={(e) => setNewTournament(e.target.value)}
              className="input"
            />
            <select
              value={subscribedTo}
              onChange={(e) => setSubscribedTo(e.target.value)}
              className="input"
            >
              <option value="">Sin suscripcion (independiente)</option>
              {tournaments.filter(t => !t.subscribedToId && !t.archived).map(t => (
                <option key={t.id} value={t.id}>
                  Suscribir a: {t.description}
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn-primary w-full">
              Crear Torneo
            </button>
          </form>
        </div>

        {/* Mappings */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Mapeos de Nombres</h2>
          <form onSubmit={handleCreateMapping} className="space-y-3 mb-4">
            <input
              type="text"
              placeholder="Numero/nombre original (ej: +54 9 381 574-8792)"
              value={newMappingKey}
              onChange={(e) => setNewMappingKey(e.target.value)}
              className="input"
            />
            <input
              type="text"
              placeholder="Nombre a mostrar (ej: Pablo)"
              value={newMappingValue}
              onChange={(e) => setNewMappingValue(e.target.value)}
              className="input"
            />
            <button type="submit" className="btn btn-success w-full">
              Agregar Mapeo
            </button>
          </form>

          <div className="max-h-48 overflow-y-auto">
            {mappings.length === 0 ? (
              <p className="text-gray-400 text-sm">No hay mapeos</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {mappings.map(m => (
                    <tr key={m.id} className="border-b border-gray-700">
                      <td className="py-1 text-gray-400 truncate max-w-[150px]" title={m.key}>
                        {m.key.substring(0, 20)}...
                      </td>
                      <td className="py-1 font-medium">{m.value}</td>
                      <td className="py-1 text-right">
                        <button
                          onClick={() => handleDeleteMapping(m.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          X
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Tournaments List */}
      <div className="card mt-6">
        <h2 className="text-xl font-bold mb-4">Torneos</h2>
        {tournaments.length === 0 ? (
          <p className="text-gray-400">No hay torneos creados</p>
        ) : (
          <div className="space-y-2">
            {tournaments.map(t => (
              <Link
                key={t.id}
                to={`/tournament/${t.id}`}
                className={`block p-3 rounded transition-colors ${
                  t.archived
                    ? 'bg-amber-900/40 hover:bg-amber-900/60 border border-amber-700'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">
                    {t.description}
                    {t.archived && (
                      <span className="ml-2 text-xs bg-amber-700 text-amber-100 px-2 py-0.5 rounded">
                        ARCHIVADO
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-gray-400">
                    {t._count.gameweeks} fechas
                    {t.subscribedTo && ` (suscrito a ${t.subscribedTo.description})`}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
