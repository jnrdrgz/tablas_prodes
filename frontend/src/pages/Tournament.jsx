import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import * as api from '../api'

export default function Tournament() {
  const { id } = useParams()
  const [tournament, setTournament] = useState(null)
  const [newGameweek, setNewGameweek] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Settings state
  const [greenCount, setGreenCount] = useState(1)
  const [redCount, setRedCount] = useState(2)
  const [showSettings, setShowSettings] = useState(false)

  const isSubscribed = tournament?.subscribedToId != null

  useEffect(() => {
    loadTournament()
  }, [id])

  async function loadTournament() {
    try {
      const data = await api.getTournament(id)
      setTournament(data)
      // Load settings
      const settings = data.settings || {}
      setGreenCount(settings.greenCount ?? 1)
      setRedCount(settings.redCount ?? 2)
      console.log('[TOURNAMENT] Loaded tournament:', data.description)
    } catch (err) {
      console.error('[TOURNAMENT] Error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateGameweek(e) {
    e.preventDefault()
    if (!newGameweek.trim()) return

    try {
      await api.createGameweek({
        description: newGameweek,
        tournamentId: id
      })
      setNewGameweek('')
      loadTournament()
      console.log('[TOURNAMENT] Gameweek created')
    } catch (err) {
      console.error('[TOURNAMENT] Error creating gameweek:', err)
      setError(err.message)
    }
  }

  async function handleDeleteGameweek(gameweekId, name) {
    if (!confirm(`Eliminar fecha "${name}"?`)) return

    try {
      await api.deleteGameweek(gameweekId)
      loadTournament()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleToggleArchive() {
    const archived = !tournament.archived
    const action = archived ? 'Archivar' : 'Desarchivar'
    if (!confirm(`${action} "${tournament.description}"? ${archived ? 'Dejara de verse en la web publica y no contara en la Tabla General.' : 'Volvera a verse en la web publica.'}`)) return

    try {
      await api.setTournamentArchived(id, archived)
      console.log(`[TOURNAMENT] Tournament ${id} archived=${archived}`)
      loadTournament()
    } catch (err) {
      console.error('[TOURNAMENT] Error archiving:', err)
      setError(err.message)
    }
  }

  async function handleSaveSettings(e) {
    e.preventDefault()
    try {
      await api.updateTournament(id, {
        description: tournament.description,
        settings: {
          greenCount: parseInt(greenCount) || 1,
          redCount: parseInt(redCount) || 2
        }
      })
      alert('Configuracion guardada')
      loadTournament()
    } catch (err) {
      console.error('[TOURNAMENT] Error saving settings:', err)
      setError(err.message)
    }
  }

  if (loading) return <div className="text-center py-8">Cargando...</div>
  if (!tournament) return <div className="text-center py-8 text-red-400">Torneo no encontrado</div>

  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/tournaments" className="text-blue-400 hover:text-blue-300 mb-4 inline-block">
        &larr; Volver a torneos
      </Link>

      <h1 className="text-3xl font-bold mb-2">
        {tournament.description}
        {tournament.archived && (
          <span className="ml-3 text-sm font-normal bg-amber-700 text-amber-100 px-2 py-1 rounded align-middle">
            ARCHIVADO
          </span>
        )}
      </h1>

      {tournament.archived && (
        <p className="text-amber-400 mb-4">
          Torneo archivado: no se muestra en la web publica y no suma en la Tabla General (si en la Tabla Historica).
        </p>
      )}

      {isSubscribed && (
        <p className="text-yellow-500 mb-4">
          Suscrito a: {tournament.subscribedTo.description}
          <span className="text-gray-400 ml-2">(fechas y resultados se sincronizan automaticamente)</span>
        </p>
      )}

      {error && (
        <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded mb-4">
          {error}
          <button onClick={() => setError('')} className="float-right">&times;</button>
        </div>
      )}

      {/* Fraud Analysis Link */}
      <Link
        to={`/fraud/${id}`}
        className="btn btn-secondary mb-4 mr-2 inline-block"
      >
        Analisis de fraude
      </Link>

      {/* Settings Toggle */}
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="btn btn-secondary mb-4 mr-2"
      >
        {showSettings ? 'Ocultar Configuracion' : 'Configuracion'}
      </button>

      {/* Archive Toggle */}
      <button
        onClick={handleToggleArchive}
        className="btn btn-secondary mb-4"
      >
        {tournament.archived ? 'Desarchivar Torneo' : 'Archivar Torneo'}
      </button>

      {/* Settings Form */}
      {showSettings && (
        <div className="card mb-6">
          <h2 className="text-xl font-bold mb-4">Configuracion de Tabla</h2>
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Primeros en verde (ganadores)
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={greenCount}
                  onChange={(e) => setGreenCount(e.target.value)}
                  className="input w-24"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Ultimos en rojo (perdedores)
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={redCount}
                  onChange={(e) => setRedCount(e.target.value)}
                  className="input w-24"
                />
              </div>
            </div>
            <button type="submit" className="btn btn-success">
              Guardar Configuracion
            </button>
          </form>
        </div>
      )}

      {/* Create Gameweek */}
      {!isSubscribed && (
        <div className="card mb-6">
          <h2 className="text-xl font-bold mb-4">Nueva Fecha</h2>
          <form onSubmit={handleCreateGameweek} className="flex gap-3">
            <input
              type="text"
              placeholder="Nombre de la fecha (ej: Fecha 1)"
              value={newGameweek}
              onChange={(e) => setNewGameweek(e.target.value)}
              className="input flex-1"
            />
            <button type="submit" className="btn btn-primary">
              Crear Fecha
            </button>
          </form>
        </div>
      )}

      {/* Gameweeks List */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Fechas ({tournament.gameweeks.length})</h2>

        {tournament.gameweeks.length === 0 ? (
          <p className="text-gray-400">No hay fechas creadas</p>
        ) : (
          <div className="space-y-2">
            {tournament.gameweeks.map((gw, index) => (
              <div key={gw.id} className="flex justify-between items-center p-3 bg-gray-700 rounded">
                <Link
                  to={`/gameweek/${gw.id}`}
                  className="flex-1 hover:text-blue-400"
                >
                  <span className="font-medium">{gw.description}</span>
                  <span className="text-sm text-gray-400 ml-3">
                    {gw._count.matches} partidos
                  </span>
                </Link>
                {!isSubscribed && (
                  <button
                    onClick={() => handleDeleteGameweek(gw.id, gw.description)}
                    className="text-red-400 hover:text-red-300 ml-4"
                  >
                    Eliminar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
