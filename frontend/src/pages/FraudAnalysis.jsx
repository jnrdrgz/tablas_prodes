import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getFraudAnalysis } from '../api'

// Color based on similarity score 0-1
function similarityColor(score) {
  if (score === null || score === undefined) return 'bg-gray-700 text-gray-500'
  if (score >= 0.8) return 'bg-red-700 text-white font-bold'
  if (score >= 0.6) return 'bg-orange-600 text-white font-bold'
  if (score >= 0.4) return 'bg-yellow-600 text-gray-900 font-semibold'
  if (score >= 0.2) return 'bg-gray-600 text-gray-200'
  return 'bg-gray-700 text-gray-400'
}

function scoreBar(score) {
  const pct = Math.round((score || 0) * 100)
  const color = score >= 0.8 ? 'bg-red-500' : score >= 0.6 ? 'bg-orange-500' : score >= 0.4 ? 'bg-yellow-500' : 'bg-gray-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-700 rounded h-2">
        <div className={`h-2 rounded ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm w-10 text-right">{pct}%</span>
    </div>
  )
}

export default function FraudAnalysis() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedPredictor, setSelectedPredictor] = useState(null)
  const [expandedGameweek, setExpandedGameweek] = useState(null)

  useEffect(() => {
    loadAnalysis()
  }, [id])

  async function loadAnalysis() {
    try {
      setLoading(true)
      const result = await getFraudAnalysis(id)
      setData(result)
      console.log('[FRAUD] Analysis loaded:', result)
    } catch (err) {
      console.error('[FRAUD] Error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="text-center py-8 text-gray-400">Analizando...</div>
  if (error) return <div className="text-center py-8 text-red-400">Error: {error}</div>
  if (!data) return null

  const { predictors, gameweeks } = data

  // All unique predictor names for the matrix
  const allNames = predictors.map(p => p.predictor)

  // Build matrix: matrix[copier][source] = avgSimilarity
  const matrix = {}
  for (const p of predictors) {
    matrix[p.predictor] = {}
    for (const cf of p.copyFrom) {
      matrix[p.predictor][cf.source] = cf.avgSimilarity
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <Link to={`/tournament/${id}`} className="text-blue-400 hover:text-blue-300 mb-4 inline-block">
        &larr; Volver al torneo
      </Link>

      <h1 className="text-3xl font-bold mb-2">Analisis de Fraude</h1>
      <p className="text-gray-400 mb-6 text-sm">
        Mide cuanto copio cada participante de otros, basado en predicciones identicas.
        Solo cuenta partidos donde ambos pusieron resultado real (no 9-9).
        El que sube mas tarde es el potencial copiador.
      </p>

      {/* Ranking por copy score */}
      <div className="card mb-6">
        <h2 className="text-xl font-bold mb-1">Ranking de sospecha</h2>
        <p className="text-gray-400 text-sm mb-4">
          CopyScore = promedio de similitud con quienes subieron antes, por fecha. Mayor score = mas sospechoso.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-600">
              <th className="text-left py-2 pr-4">#</th>
              <th className="text-left py-2 pr-4">Participante</th>
              <th className="text-left py-2 pr-4 w-48">CopyScore general</th>
              <th className="text-right py-2 pr-4">Rank subida promedio</th>
              <th className="text-right py-2">Fechas</th>
            </tr>
          </thead>
          <tbody>
            {predictors.map((p, i) => (
              <tr
                key={p.predictor}
                className={`border-b border-gray-700 cursor-pointer hover:bg-gray-700 ${selectedPredictor === p.predictor ? 'bg-gray-700' : ''}`}
                onClick={() => setSelectedPredictor(selectedPredictor === p.predictor ? null : p.predictor)}
              >
                <td className="py-2 pr-4 text-gray-500">{i + 1}</td>
                <td className="py-2 pr-4 font-medium">
                  {p.predictor}
                  {p.totalCopyScore >= 0.6 && <span className="ml-2 text-xs bg-red-800 text-red-200 px-1 rounded">sospechoso</span>}
                </td>
                <td className="py-2 pr-4 w-48">{scoreBar(p.totalCopyScore)}</td>
                <td className="py-2 pr-4 text-right text-gray-300">
                  {p.avgUploadRank.toFixed(1)}
                  <span className="text-gray-500 ml-1 text-xs">(0=primero)</span>
                </td>
                <td className="py-2 text-right text-gray-400">{p.gameweeksParticipated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detalle de a quien copia el predictor seleccionado */}
      {selectedPredictor && (() => {
        const p = predictors.find(x => x.predictor === selectedPredictor)
        return (
          <div className="card mb-6 border border-yellow-700">
            <h2 className="text-lg font-bold mb-3">
              {selectedPredictor} &mdash; a quien copia
            </h2>
            {p.copyFrom.length === 0 ? (
              <p className="text-gray-400 text-sm">Siempre fue el primero en subir, no se puede medir copia.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-600">
                    <th className="text-left py-1 pr-4">Fuente (subio antes)</th>
                    <th className="text-left py-1 pr-4 w-48">Similitud promedio</th>
                    <th className="text-right py-1">Fechas en comun</th>
                  </tr>
                </thead>
                <tbody>
                  {p.copyFrom.map(cf => (
                    <tr key={cf.source} className="border-b border-gray-700">
                      <td className="py-2 pr-4 font-medium">{cf.source}</td>
                      <td className="py-2 pr-4 w-48">{scoreBar(cf.avgSimilarity)}</td>
                      <td className="py-2 text-right text-gray-400">{cf.gameweeksCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )
      })()}

      {/* Matriz de similitud */}
      <div className="card mb-6 overflow-x-auto">
        <h2 className="text-xl font-bold mb-1">Matriz de copia</h2>
        <p className="text-gray-400 text-sm mb-4">
          Fila = potencial copiador. Columna = fuente (subio antes). Celda = similitud promedio cuando la fila subio despues de la columna.
          <br />
          <span className="inline-block w-3 h-3 bg-red-700 rounded mr-1 mt-1" />alta (80%+)
          <span className="inline-block w-3 h-3 bg-orange-600 rounded mr-1 ml-3" />media-alta (60-79%)
          <span className="inline-block w-3 h-3 bg-yellow-600 rounded mr-1 ml-3" />media (40-59%)
          <span className="inline-block w-3 h-3 bg-gray-600 rounded mr-1 ml-3" />baja (&lt;40%)
        </p>
        <table className="text-xs border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-left text-gray-400 border-b border-gray-600 min-w-24">Copiador ↓ / Fuente →</th>
              {allNames.map(name => (
                <th key={name} className="p-2 text-gray-300 border-b border-gray-600 min-w-16 text-center">
                  <div className="transform -rotate-45 origin-bottom-left whitespace-nowrap py-4 text-xs">
                    {name}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allNames.map(row => (
              <tr key={row} className="border-b border-gray-700">
                <td className="p-2 font-medium text-gray-200 border-r border-gray-600">{row}</td>
                {allNames.map(col => {
                  if (row === col) {
                    return <td key={col} className="p-2 bg-gray-800 text-center text-gray-600">—</td>
                  }
                  const val = matrix[row]?.[col]
                  return (
                    <td key={col} className={`p-2 text-center ${similarityColor(val)}`}>
                      {val !== undefined ? `${Math.round(val * 100)}%` : ''}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detalle por fecha */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Detalle por fecha</h2>
        <div className="space-y-2">
          {gameweeks.map(gw => (
            <div key={gw.gameweekId} className="border border-gray-600 rounded">
              <button
                className="w-full flex justify-between items-center p-3 hover:bg-gray-700 text-left"
                onClick={() => setExpandedGameweek(expandedGameweek === gw.gameweekId ? null : gw.gameweekId)}
              >
                <span className="font-medium">{gw.description}</span>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <span>{gw.uploadOrder.length} participantes</span>
                  <span>{gw.pairs.length} pares</span>
                  <span>{expandedGameweek === gw.gameweekId ? '▲' : '▼'}</span>
                </div>
              </button>

              {expandedGameweek === gw.gameweekId && (
                <div className="p-4 border-t border-gray-600 grid md:grid-cols-2 gap-6">

                  {/* Orden de subida */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-400 mb-2 uppercase tracking-wide">Orden de subida</h3>
                    <div className="space-y-1">
                      {gw.uploadOrder.map((u, i) => {
                        const copyScore = gw.copyScores?.[u.predictor]
                        return (
                          <div key={u.predictor} className="flex items-center justify-between text-sm p-2 bg-gray-700 rounded">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500 w-4">{i + 1}</span>
                              <span className="font-medium">{u.predictor}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-gray-400 text-xs">
                                {new Date(u.uploadedAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                              {copyScore !== null && copyScore !== undefined && (
                                <span className={`text-xs px-1 rounded ${similarityColor(copyScore)}`}>
                                  copy {Math.round(copyScore * 100)}%
                                </span>
                              )}
                              {(copyScore === null || i === 0) && (
                                <span className="text-xs text-gray-500 px-1">primero</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Top pares similares */}
                  <div>
                    <h3 className="text-sm font-bold text-gray-400 mb-2 uppercase tracking-wide">Pares mas similares</h3>
                    {gw.pairs.length === 0 ? (
                      <p className="text-gray-500 text-sm">Sin datos</p>
                    ) : (
                      <div className="space-y-1">
                        {gw.pairs.slice(0, 8).map((pair, i) => {
                          const copier = pair.aFirst ? pair.b : pair.a
                          const source = pair.aFirst ? pair.a : pair.b
                          return (
                            <div key={i} className={`flex items-center justify-between text-sm p-2 rounded ${similarityColor(pair.similarity)}`}>
                              <span>
                                <span className="font-medium">{copier}</span>
                                <span className="mx-1 opacity-60">copio de</span>
                                <span className="font-medium">{source}</span>
                              </span>
                              <span className="text-xs">
                                {pair.identical}/{pair.total} ({Math.round(pair.similarity * 100)}%)
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
