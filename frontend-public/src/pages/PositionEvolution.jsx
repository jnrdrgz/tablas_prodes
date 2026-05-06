import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getTournamentEvolution, getTournament } from '../api'

function positionColor(pos, total) {
  if (pos === null) return 'text-gray-500'
  if (pos === 1) return 'text-yellow-400 font-bold'
  if (pos <= Math.ceil(total * 0.25)) return 'text-green-400'
  if (pos >= total - Math.floor(total * 0.25)) return 'text-red-400'
  return 'text-gray-200'
}

function shortDescription(desc) {
  // Try to extract a number if the description contains one, otherwise take first 8 chars
  const match = desc.match(/\d+/)
  if (match) return `F${match[0]}`
  return desc.substring(0, 6)
}

export default function PositionEvolution() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [tournament, setTournament] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [id])

  async function loadData() {
    try {
      setLoading(true)
      const [evo, t] = await Promise.all([
        getTournamentEvolution(id),
        getTournament(id)
      ])
      setData(evo)
      setTournament(t)
      console.log('[EVOLUTION] Loaded evolution data for tournament', id)
    } catch (err) {
      console.error('[EVOLUTION] Error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="text-center py-8">Cargando evolución...</div>
  if (error) return <div className="text-center py-8 text-red-400">Error: {error}</div>

  const totalPredictors = data?.evolution?.length ?? 0

  return (
    <div className="max-w-full mx-auto px-2">
      <Link
        to={`/tournament/${id}`}
        className="text-red-400 hover:text-red-300 mb-4 inline-block"
      >
        &larr; Volver a {tournament?.description}
      </Link>

      <h1 className="text-2xl font-bold mb-1">Evolución de Posiciones</h1>
      <p className="text-gray-400 mb-4">{tournament?.description}</p>

      {!data || data.gameweeks.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-gray-400">No hay fechas con suficientes partidos todavía</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <p className="text-sm text-gray-400 mb-3">
            Posición acumulada al final de cada fecha (fechas con 3+ partidos)
          </p>
          <table className="table-dark min-w-max">
            <thead>
              <tr>
                <th className="sticky left-0 bg-gray-700 z-10 text-left">Participante</th>
                {data.gameweeks.map(gw => (
                  <th key={gw.id} title={gw.description} className="text-center px-3">
                    {shortDescription(gw.description)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.evolution.map(({ predictor, positions }) => {
                const lastPos = positions[positions.length - 1]
                return (
                  <tr key={predictor}>
                    <td className="sticky left-0 bg-gray-800 z-10 font-medium text-left">
                      {predictor}
                    </td>
                    {positions.map((pos, i) => {
                      const prev = i > 0 ? positions[i - 1] : null
                      const arrow = prev === null || pos === null ? '' : pos < prev ? ' ▲' : pos > prev ? ' ▼' : ''
                      return (
                        <td key={i} className={`text-center ${positionColor(pos, totalPredictors)}`}>
                          {pos !== null ? `${pos}${arrow}` : '-'}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
