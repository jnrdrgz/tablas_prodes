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

// What a predictions upload is going to load (dry run response), with confirm/cancel
function UploadPreview({ preview, matches, onConfirm, onCancel }) {
  return (
    <div className="mt-4 border-t border-gray-700 pt-4">
      <h4 className="font-bold mb-2">Se va a cargar ({preview.predictions.length} participantes)</h4>

      {preview.predictions.length === 0 ? (
        <p className="text-yellow-400 mb-2">No se encontraron predicciones en el texto</p>
      ) : (
        <div className="overflow-x-auto mb-2">
          <table className="table-dark min-w-max">
            <thead>
              <tr>
                <th className="text-left">Participante</th>
                {matches.map(m => (
                  <th key={m.id} title={m.description}>{getMatchShortName(m.description)}</th>
                ))}
                <th className="text-left">Notas</th>
              </tr>
            </thead>
            <tbody>
              {preview.predictions.map((p, i) => {
                const extra = p.results.length - matches.length
                return (
                  <tr key={i}>
                    <td className="text-left font-medium">{p.predictor}</td>
                    {matches.map((m, j) => (
                      <td key={m.id}>{p.results[j] || '-'}</td>
                    ))}
                    <td className="text-left text-xs">
                      {p.alreadyLoaded && <div className="text-blue-300">Ya tenia prode: se actualiza</div>}
                      {extra < 0 && <div className="text-yellow-400">Faltan {-extra} resultados</div>}
                      {extra > 0 && <div className="text-yellow-400">Sobran {extra} resultados (se ignoran)</div>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {preview.filledWith99.length > 0 && (
        <p className="text-sm mb-2">
          Se completan con 9-9 ({preview.filledWith99.length}): {preview.filledWith99.join(', ')}
        </p>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={onConfirm} className="btn btn-success">Confirmar carga</button>
        <button type="button" onClick={onCancel} className="btn btn-secondary">Cancelar</button>
      </div>
    </div>
  )
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
  // null (closed) | 'whatsapp' | 'wpweb'
  const [predictionsFormat, setPredictionsFormat] = useState(null)
  const [fillMissing, setFillMissing] = useState(false)
  const [validateBeforeUpload, setValidateBeforeUpload] = useState(false)
  // Dry run result shown for confirmation; cleared whenever the text or options change
  const [uploadPreview, setUploadPreview] = useState(null)
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

  function togglePredictionsForm(format) {
    setPredictionsFormat(predictionsFormat === format ? null : format)
    setUploadPreview(null)
  }

  async function uploadPredictions() {
    console.log(`[GAMEWEEK] Uploading predictions (format=${predictionsFormat}, fillMissing=${fillMissing})`)
    try {
      const result = await api.uploadPredictionsBulk(id, predictionsText, predictionsFormat, fillMissing)
      let message = `Predicciones cargadas: ${result.created} creadas, ${result.updated} actualizadas`
      if (result.filledWith99?.length > 0) {
        message += `\nCompletados con 9-9 (${result.filledWith99.length}): ${result.filledWith99.join(', ')}`
      }
      console.log('[GAMEWEEK]', message)
      alert(message)
      setPredictionsText('')
      setPredictionsFormat(null)
      setUploadPreview(null)
      loadData()
    } catch (err) {
      console.error('[GAMEWEEK] Error uploading predictions:', err)
      setError(err.message)
    }
  }

  async function handleUploadPredictions(e) {
    e.preventDefault()
    if (!predictionsText.trim()) return

    if (!validateBeforeUpload) {
      await uploadPredictions()
      return
    }

    console.log(`[GAMEWEEK] Validating predictions before upload (format=${predictionsFormat}, fillMissing=${fillMissing})`)
    try {
      const preview = await api.uploadPredictionsBulk(id, predictionsText, predictionsFormat, fillMissing, true)
      console.log(`[GAMEWEEK] Preview: ${preview.predictions.length} participants, ${preview.filledWith99.length} filled with 9-9`)
      setUploadPreview(preview)
    } catch (err) {
      console.error('[GAMEWEEK] Error validating predictions:', err)
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
          onClick={() => togglePredictionsForm('whatsapp')}
          className="btn btn-primary"
        >
          {predictionsFormat === 'whatsapp' ? 'Cerrar' : 'Cargar Predicciones (WhatsApp)'}
        </button>
        <button
          onClick={() => togglePredictionsForm('wpweb')}
          className="btn btn-primary"
        >
          {predictionsFormat === 'wpweb' ? 'Cerrar' : 'Cargar Predicciones (WP Web)'}
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

      {predictionsFormat && (
        <div className="card mb-4">
          <h3 className="font-bold mb-2">
            {predictionsFormat === 'wpweb' ? 'Cargar Predicciones desde WhatsApp Web' : 'Cargar Predicciones desde WhatsApp'}
          </h3>
          <p className="text-sm text-gray-400 mb-2">
            {predictionsFormat === 'wpweb'
              ? 'Pegar los mensajes copiados de WhatsApp Web (cada mensaje empieza con [hora, fecha] Nombre:)'
              : 'Pegar el texto copiado de WhatsApp con las predicciones de todos'}
          </p>
          <form onSubmit={handleUploadPredictions}>
            <textarea
              value={predictionsText}
              onChange={(e) => { setPredictionsText(e.target.value); setUploadPreview(null) }}
              className="textarea h-48 mb-2"
              placeholder={predictionsFormat === 'wpweb'
                ? '[15:19, 9/4/2026] Juan Rodríguez: Estudiantes RC 0-1 Sarmiento\nBelgrano 1-0 Huracán\n[16:17, 9/4/2026] +54 9 3512 87-0987: Estudiantes RC 0-0 Sarmiento\n...'
                : '[1/21, 21:39] PMolina: Aldosivi 1-1 Defensa\nBanfield 0-2 Huracan\n[1/21, 23:13] +54 9 381 574-8792: Aldosivi 1-0 Defensa\n...'}
            />
            <label className="flex items-center gap-2 mb-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={fillMissing}
                onChange={(e) => { setFillMissing(e.target.checked); setUploadPreview(null) }}
              />
              Cargar faltantes con 9-9
              <span className="text-gray-400">
                (los de la tabla de puntos del torneo que no mandaron prode quedan con 9-9 en todos los partidos)
              </span>
            </label>
            <label className="flex items-center gap-2 mb-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={validateBeforeUpload}
                onChange={(e) => { setValidateBeforeUpload(e.target.checked); setUploadPreview(null) }}
              />
              Validar antes de cargar
              <span className="text-gray-400">(muestra lo que se va a cargar y pide confirmar)</span>
            </label>
            <button type="submit" className="btn btn-success">
              {validateBeforeUpload ? 'Validar' : 'Cargar Predicciones'}
            </button>
          </form>

          {uploadPreview && (
            <UploadPreview
              preview={uploadPreview}
              matches={gameweek.matches}
              onConfirm={uploadPredictions}
              onCancel={() => setUploadPreview(null)}
            />
          )}
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
