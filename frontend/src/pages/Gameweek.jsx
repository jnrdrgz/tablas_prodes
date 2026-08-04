import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { toPng } from 'html-to-image'
import * as api from '../api'

function compareResult(prediction, realResult) {
  if (!prediction || !realResult || prediction === '9-9' || realResult === '9-9') {
    return 'skip'
  }

  const [predHome, predAway] = prediction.split('-').map(Number)
  const [realHome, realAway] = realResult.split('-').map(Number)

  if (predHome === realHome && predAway === realAway) {
    return 'exact'
  }

  const predWinner = predHome > predAway ? 'home' : predHome < predAway ? 'away' : 'draw'
  const realWinner = realHome > realAway ? 'home' : realHome < realAway ? 'away' : 'draw'

  if (predWinner === realWinner) {
    return 'winner'
  }

  return 'wrong'
}

function getMatchShortName(description) {
  const parts = description.split('-').map(s => s.trim())
  if (parts.length >= 2) {
    return parts[0].substring(0, 3).toUpperCase() + '-' + parts[1].substring(0, 3).toUpperCase()
  }
  return description.substring(0, 7)
}

export default function Gameweek() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [gameweek, setGameweek] = useState(null)
  const [points, setPoints] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Form states
  const [matchesText, setMatchesText] = useState('')
  const [predictionsText, setPredictionsText] = useState('')
  const [resultsText, setResultsText] = useState('')
  const [showMatchesForm, setShowMatchesForm] = useState(false)
  const [showPredictionsForm, setShowPredictionsForm] = useState(false)
  const [showResultsForm, setShowResultsForm] = useState(false)
  const [predictorsOrder, setPredictorsOrder] = useState('alpha')

  const isSubscribed = gameweek?.tournament?.subscribedToId != null

  // Refs for table screenshots
  const predictionsTableRef = useRef(null)
  const gameweekPointsRef = useRef(null)
  const tournamentPointsRef = useRef(null)
  const allTablesRef = useRef(null)

  // Download table as image (same implementation as the public frontend)
  async function downloadAsImage(element, filename) {
    if (!element) return
    try {
      // Use scrollWidth/scrollHeight so the full table is captured on mobile
      // (not just the visible overflow area). The style override tells
      // html-to-image to expand the root element to its full scrollable size.
      const dataUrl = await toPng(element, {
        backgroundColor: '#1f2937',
        pixelRatio: 2,
        skipFonts: true,
        width: element.scrollWidth,
        height: element.scrollHeight,
        style: {
          overflow: 'visible',
          width: element.scrollWidth + 'px',
          height: element.scrollHeight + 'px',
          maxWidth: 'none',
        },
      })
      const link = document.createElement('a')
      link.download = `${filename}.png`
      link.href = dataUrl
      link.click()
      console.log('[GAMEWEEK] Downloaded image:', filename)
    } catch (err) {
      console.error('[GAMEWEEK] Error downloading image:', err)
      alert('Error al descargar imagen')
    }
  }

  async function downloadAllTables() {
    if (!allTablesRef.current) return
    await downloadAsImage(allTablesRef.current, `${gameweek.description}-completo`)
  }

  useEffect(() => {
    loadData()
  }, [id])

  async function loadData() {
    try {
      setLoading(true)
      const [gwData, pointsData] = await Promise.all([
        api.getGameweek(id),
        api.getGameweekPoints(id)
      ])
      setGameweek(gwData)
      setPoints(pointsData)
      console.log('[GAMEWEEK] Loaded gameweek:', gwData.description)
    } catch (err) {
      console.error('[GAMEWEEK] Error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleAddMatches(e) {
    e.preventDefault()
    if (!matchesText.trim()) return

    try {
      await api.createMatchesBulk(id, matchesText)
      setMatchesText('')
      setShowMatchesForm(false)
      loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleUploadPredictions(e) {
    e.preventDefault()
    if (!predictionsText.trim()) return

    try {
      const result = await api.uploadPredictionsBulk(id, predictionsText)
      alert(`Predicciones cargadas: ${result.created} creadas, ${result.updated} actualizadas`)
      setPredictionsText('')
      setShowPredictionsForm(false)
      loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleUpdateResults(e) {
    e.preventDefault()
    if (!resultsText.trim()) return

    try {
      const result = await api.updateResultsBulk(id, resultsText)
      alert(`Resultados actualizados: ${result.updated}`)
      setResultsText('')
      setShowResultsForm(false)
      loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDeleteGameweek() {
    if (!confirm(`Eliminar fecha "${gameweek.description}"? Esto eliminara todos los partidos y predicciones.`)) return

    try {
      await api.deleteGameweek(id)
      navigate(`/tournament/${gameweek.tournamentId}`)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDeleteAllPredictions() {
    if (!confirm(`Eliminar TODAS las predicciones de esta fecha? Esta accion no se puede deshacer.`)) return

    try {
      const result = await api.deleteGameweekPredictions(id)
      alert(`${result.deleted} predicciones eliminadas`)
      loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <div className="text-center py-8">Cargando...</div>
  if (!gameweek) return <div className="text-center py-8 text-red-400">Fecha no encontrada</div>

  // Get all unique predictors
  const predictors = new Set()
  gameweek.matches.forEach(m => {
    m.predictions.forEach(p => predictors.add(p.predictor))
  })
  const predictorsList = Array.from(predictors).sort()

  // Build prediction map for quick lookup
  const predictionMap = {}
  gameweek.matches.forEach(m => {
    m.predictions.forEach(p => {
      predictionMap[`${m.id}-${p.predictor}`] = p.result
    })
  })

  // Sort predictors based on selected order
  const sortedPredictors = (() => {
    if (predictorsOrder === 'alpha' || !points) return predictorsList
    const pointsArr = predictorsOrder === 'gameweek' ? points.gameweekPoints : points.tournamentPoints
    const orderMap = {}
    pointsArr.forEach((p, i) => { orderMap[p.predictor] = i })
    return [...predictorsList].sort((a, b) => {
      const posA = orderMap[a] ?? Number.MAX_SAFE_INTEGER
      const posB = orderMap[b] ?? Number.MAX_SAFE_INTEGER
      return posA - posB
    })
  })()

  // Check for predictors with more than 6 equal results
  const predictorsWithRepeats = new Set()
  predictorsList.forEach(predictor => {
    const resultCounts = {}
    gameweek.matches.forEach(m => {
      const pred = predictionMap[`${m.id}-${predictor}`]
      if (pred && pred !== '9-9') {
        resultCounts[pred] = (resultCounts[pred] || 0) + 1
      }
    })
    if (Object.values(resultCounts).some(count => count > 7)) {
      predictorsWithRepeats.add(predictor)
    }
  })

  return (
    <div className="max-w-full mx-auto px-2">
      <Link
        to={`/tournament/${gameweek.tournamentId}`}
        className="text-blue-400 hover:text-blue-300 mb-4 inline-block"
      >
        &larr; Volver a {gameweek.tournament.description}
      </Link>

      <div className="flex justify-between items-start mb-2">
        <h1 className="text-2xl font-bold">{gameweek.description}</h1>
        <button
          onClick={handleDeleteGameweek}
          className="btn btn-danger text-sm"
        >
          Eliminar Fecha
        </button>
      </div>
      <p className="text-gray-400 mb-4">Torneo: {gameweek.tournament.description}</p>

      {isSubscribed && (
        <p className="text-yellow-500 mb-4">
          Este torneo esta suscrito. Los partidos y resultados se sincronizan automaticamente.
        </p>
      )}

      {error && (
        <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded mb-4 whitespace-pre-line">
          {error}
          <button onClick={() => setError('')} className="float-right">&times;</button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        {!isSubscribed && (
          <>
            <button
              onClick={() => setShowMatchesForm(!showMatchesForm)}
              className="btn btn-secondary"
            >
              {showMatchesForm ? 'Cerrar' : 'Agregar Partidos'}
            </button>
            <button
              onClick={() => {
                const opening = !showResultsForm
                if (opening && gameweek?.matches?.length > 0) {
                  const preloaded = gameweek.matches.map(m => {
                    if (m.result && m.result !== '9-9') {
                      const parts = m.description.split('-').map(s => s.trim())
                      const [home, away] = m.result.split('-')
                      return parts.length >= 2
                        ? `${parts[0]} ${home}-${away} ${parts[1]}`
                        : `${m.description} ${m.result}`
                    }
                    return m.description
                  }).join('\n')
                  setResultsText(preloaded)
                }
                setShowResultsForm(opening)
              }}
              className="btn btn-secondary"
            >
              {showResultsForm ? 'Cerrar' : 'Cargar Resultados'}
            </button>
          </>
        )}
        <button
          onClick={() => setShowPredictionsForm(!showPredictionsForm)}
          className="btn btn-primary"
        >
          {showPredictionsForm ? 'Cerrar' : 'Cargar Predicciones (WhatsApp)'}
        </button>
        {predictorsList.length > 0 && (
          <button
            onClick={handleDeleteAllPredictions}
            className="btn btn-danger"
          >
            Borrar Predicciones
          </button>
        )}
      </div>

      {/* Forms */}
      {showMatchesForm && !isSubscribed && (
        <div className="card mb-4">
          <h3 className="font-bold mb-2">Agregar Partidos</h3>
          <p className="text-sm text-gray-400 mb-2">Un partido por linea (ej: Boca - River)</p>
          <form onSubmit={handleAddMatches}>
            <textarea
              value={matchesText}
              onChange={(e) => setMatchesText(e.target.value)}
              className="textarea h-40 mb-2"
              placeholder="Boca - River&#10;Racing - Independiente&#10;..."
            />
            <button type="submit" className="btn btn-success">Agregar</button>
          </form>
        </div>
      )}

      {showResultsForm && !isSubscribed && (
        <div className="card mb-4">
          <h3 className="font-bold mb-2">Cargar Resultados Reales</h3>
          <p className="text-sm text-gray-400 mb-2">
            Pegar resultados en orden. Se extraeran los numeros (ej: "Boca 2-1 River" = 2-1)
          </p>
          <form onSubmit={handleUpdateResults}>
            <textarea
              value={resultsText}
              onChange={(e) => setResultsText(e.target.value)}
              className="textarea h-40 mb-2"
              placeholder="Boca 2-1 River&#10;Racing 0-0 Independiente&#10;..."
            />
            <button type="submit" className="btn btn-success">Actualizar Resultados</button>
          </form>
        </div>
      )}

      {showPredictionsForm && (
        <div className="card mb-4">
          <h3 className="font-bold mb-2">Cargar Predicciones desde WhatsApp</h3>
          <p className="text-sm text-gray-400 mb-2">
            Pegar el texto copiado de WhatsApp con las predicciones de todos
          </p>
          <form onSubmit={handleUploadPredictions}>
            <textarea
              value={predictionsText}
              onChange={(e) => setPredictionsText(e.target.value)}
              className="textarea h-48 mb-2"
              placeholder="[1/21, 21:39] PMolina: Aldosivi 1-1 Defensa&#10;Banfield 0-2 Huracan&#10;[1/21, 23:13] +54 9 381 574-8792: Aldosivi 1-0 Defensa&#10;..."
            />
            <button type="submit" className="btn btn-success">Cargar Predicciones</button>
          </form>
        </div>
      )}

      {/* Predictions Table */}
      {gameweek.matches.length > 0 && (
        <div className="card mb-6 overflow-x-auto" ref={predictionsTableRef}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Tabla de Predicciones</h2>
            <div className="flex items-center gap-2">
              <select
                value={predictorsOrder}
                onChange={(e) => setPredictorsOrder(e.target.value)}
                className="input w-auto text-sm"
              >
                <option value="alpha">Alfabetico</option>
                <option value="gameweek">Puntos Fecha</option>
                <option value="tournament">Puntos Torneo</option>
              </select>
              <button
                onClick={() => downloadAsImage(predictionsTableRef.current, `${gameweek.description}-predicciones`)}
                className="btn btn-secondary text-sm"
                title="Descargar como imagen"
              >
                📷 Descargar
              </button>
            </div>
          </div>
          <table className="table-dark min-w-max">
            <thead>
              <tr>
                <th className="sticky left-0 bg-gray-700 z-10">Participante</th>
                {gameweek.matches.map(m => (
                  <th key={m.id} title={m.description}>
                    {getMatchShortName(m.description)}
                    {m.result && (
                      <div className="text-xs font-normal text-green-400">{m.result}</div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedPredictors.map(predictor => (
                <tr key={predictor}>
                  <td className="sticky left-0 bg-gray-800 z-10 font-medium text-left">
                    {predictorsWithRepeats.has(predictor) && (
                      <span className="text-yellow-400 font-bold mr-1" title="Mas de 7 resultados iguales">!</span>
                    )}
                    {predictor}
                  </td>
                  {gameweek.matches.map(m => {
                    const pred = predictionMap[`${m.id}-${predictor}`]
                    const status = m.result ? compareResult(pred, m.result) : 'pending'
                    return (
                      <td
                        key={m.id}
                        className={`result-${status}`}
                      >
                        {pred || '-'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Points Tables */}
      {points && (() => {
        const settings = gameweek.tournament.settings || {}
        const greenCount = settings.greenCount ?? 1
        const redCount = settings.redCount ?? 2

        const getRowClass = (index, total) => {
          if (index < greenCount) return 'bg-green-900'
          if (index >= total - redCount) return 'bg-red-900'
          return ''
        }

        return (
          <>
            {/* Download All Tables Button */}
            <div className="flex justify-end mb-4">
              <button
                onClick={downloadAllTables}
                className="btn btn-primary"
                title="Descargar todas las tablas como imagen"
              >
                📷 Descargar Todas las Tablas
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-6" ref={allTablesRef}>
              {/* Gameweek Points */}
              <div className="card" ref={gameweekPointsRef}>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">Puntos Fecha</h2>
                  <button
                    onClick={() => downloadAsImage(gameweekPointsRef.current, `${gameweek.description}-puntos-fecha`)}
                    className="btn btn-secondary text-sm"
                    title="Descargar como imagen"
                  >
                    📷
                  </button>
                </div>
              {points.gameweekPoints.length === 0 ? (
                <p className="text-gray-400">Sin datos</p>
              ) : (
                <table className="table-dark">
                  <thead>
                    <tr>
                      <th>Pos</th>
                      <th className="text-left">Participante</th>
                      <th>Pts</th>
                      <th>Plenos</th>
                      <th>Goles</th>
                    </tr>
                  </thead>
                  <tbody>
                    {points.gameweekPoints.map((p, i) => (
                      <tr key={p.predictor} className={getRowClass(i, points.gameweekPoints.length)}>
                        <td>{i + 1}</td>
                        <td className="text-left font-medium">{p.predictor}</td>
                        <td className="font-bold">{p.puntos}</td>
                        <td>{p.plenos}</td>
                        <td>{p.goles}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Tournament Points */}
            <div className="card" ref={tournamentPointsRef}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Puntos Torneo (hasta esta fecha)</h2>
                <button
                  onClick={() => downloadAsImage(tournamentPointsRef.current, `${gameweek.description}-puntos-torneo`)}
                  className="btn btn-secondary text-sm"
                  title="Descargar como imagen"
                >
                  📷
                </button>
              </div>
              {points.tournamentPoints.length === 0 ? (
                <p className="text-gray-400">Sin datos</p>
              ) : (
                <table className="table-dark">
                  <thead>
                    <tr>
                      <th>Pos</th>
                      <th className="text-left">Participante</th>
                      <th>Pts</th>
                      <th>Plenos</th>
                      <th>Goles</th>
                    </tr>
                  </thead>
                  <tbody>
                    {points.tournamentPoints.map((p, i) => (
                      <tr
                        key={p.predictor}
                        className={getRowClass(i, points.tournamentPoints.length)}
                      >
                        <td>{i + 1}</td>
                        <td className="text-left font-medium">{p.predictor}</td>
                        <td className="font-bold">{p.puntos}</td>
                        <td>{p.plenos}</td>
                        <td>{p.goles}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
          </>
        )
      })()}

      {gameweek.matches.length === 0 && (
        <div className="card text-center py-8">
          <p className="text-gray-400">No hay partidos en esta fecha</p>
          {!isSubscribed && (
            <button
              onClick={() => setShowMatchesForm(true)}
              className="btn btn-primary mt-4"
            >
              Agregar Partidos
            </button>
          )}
        </div>
      )}
    </div>
  )
}
