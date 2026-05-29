import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import html2canvas from 'html2canvas'
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

function isTennisDescription(desc) {
  return /^[A-Z]\.\s+\S/.test(desc)
}

function getTennisShortName(desc) {
  const cleaned = desc
    .replace(/\([^)]*\)/g, '')
    .replace(/\d+\s*-\s*\d+/g, '')
    .replace(/\s+-\s+/g, ' ')
    .replace(/\bvs\.?\b/gi, '')
    .trim()

  const tokens = cleaned.split(/\s+/).filter(Boolean)
  const players = []
  let currentWords = []
  let inPlayer = false

  for (const token of tokens) {
    if (/^[A-Z]\.$/.test(token)) {
      if (inPlayer && currentWords.length > 0) {
        players.push(currentWords)
        currentWords = []
      }
      inPlayer = true
    } else if (inPlayer) {
      currentWords.push(token)
    }
  }
  if (currentWords.length > 0) players.push(currentWords)

  if (players.length < 2) return desc.substring(0, 7)

  const abbr = (words) =>
    words[words.length - 1].replace(/[^a-zA-ZáéíóúñüÁÉÍÓÚÑÜ]/g, '').substring(0, 3).toUpperCase()

  return `${abbr(players[0])}-${abbr(players[1])}`
}

function getMatchShortName(description) {
  if (isTennisDescription(description)) return getTennisShortName(description)
  const parts = description.split('-').map(s => s.trim())
  if (parts.length >= 2) {
    return parts[0].substring(0, 3).toUpperCase() + '-' + parts[1].substring(0, 3).toUpperCase()
  }
  return description.substring(0, 7)
}

export default function Gameweek() {
  const { id } = useParams()
  const [gameweek, setGameweek] = useState(null)
  const [points, setPoints] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [predictorsOrder, setPredictorsOrder] = useState('alpha')

  // Refs for table screenshots
  const predictionsTableRef = useRef(null)
  const gameweekPointsRef = useRef(null)
  const tournamentPointsRef = useRef(null)
  const allTablesRef = useRef(null)

  // Download table as image
  async function downloadAsImage(element, filename) {
    if (!element) return

    let clone = null
    try {
      // Clone so we don't modify the real DOM
      clone = element.cloneNode(true)

      // Strip overflow so html2canvas captures the full table width
      clone.style.overflow = 'visible'
      clone.style.overflowX = 'visible'
      clone.style.width = 'auto'
      clone.style.maxWidth = 'none'

      // Replace sticky positioning — html2canvas misrenders sticky elements,
      // causing wrong column widths and broken text-align: center
      clone.querySelectorAll('*').forEach(el => {
        if (window.getComputedStyle(el).position === 'sticky') {
          el.style.position = 'relative'
        }
      })

      // html2canvas ignores vertical-align: middle from stylesheets on table cells,
      // forcing it inline is the only reliable workaround
      clone.querySelectorAll('td, th').forEach(el => {
        el.style.verticalAlign = 'middle'
      })

      // Mount off-screen so html2canvas can measure it
      clone.style.position = 'fixed'
      clone.style.top = '-99999px'
      clone.style.left = '-99999px'
      document.body.appendChild(clone)

      const canvas = await html2canvas(clone, {
        backgroundColor: '#362222',
        scale: 2,
        logging: false,
        useCORS: true,
      })

      const link = document.createElement('a')
      link.download = `${filename}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()

      console.log('[GAMEWEEK] Downloaded image:', filename)
    } catch (err) {
      console.error('[GAMEWEEK] Error downloading image:', err)
      alert('Error al descargar imagen')
    } finally {
      if (clone) document.body.removeChild(clone)
    }
  }

  async function downloadAllTables() {
    if (!allTablesRef.current) return
    await downloadAsImage(allTablesRef.current, `${gameweek.description}-completo`)
  }

  // Alternative download using html-to-image (better CSS support)
  async function downloadAsImageV2(element, filename) {
    if (!element) return
    try {
      // Use scrollWidth/scrollHeight so the full table is captured on mobile
      // (not just the visible overflow area). The style override tells
      // html-to-image to expand the root element to its full scrollable size.
      const dataUrl = await toPng(element, {
        backgroundColor: '#362222',
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
      console.log('[GAMEWEEK] Downloaded image (v2):', filename)
    } catch (err) {
      console.error('[GAMEWEEK] Error downloading image (v2):', err)
      alert('Error al descargar imagen')
    }
  }

  async function downloadAllTablesV2() {
    if (!allTablesRef.current) return
    await downloadAsImageV2(allTablesRef.current, `${gameweek.description}-completo`)
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

  return (
    <div className="max-w-full mx-auto px-2">
      <Link
        to={`/tournament/${gameweek.tournamentId}`}
        className="text-red-400 hover:text-red-300 mb-4 inline-block"
      >
        &larr; Volver a {gameweek.tournament.description}
      </Link>

      <h1 className="text-2xl font-bold mb-2">{gameweek.description}</h1>
      <p className="text-gray-400 mb-4">Torneo: {gameweek.tournament.description}</p>

      {error && (
        <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded mb-4">
          {error}
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
              {/* <button
                onClick={() => downloadAsImage(predictionsTableRef.current, `${gameweek.description}-predicciones`)}
                className="btn btn-secondary text-sm"
                title="Descargar (html2canvas)"
              >
                📷 Descargar
              </button> */}
              <button
                onClick={() => downloadAsImageV2(predictionsTableRef.current, `${gameweek.description}-predicciones`)}
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
            <div className="flex justify-end gap-2 mb-4">
              {/* <button
                onClick={downloadAllTables}
                className="btn btn-primary"
                title="Descargar todas las tablas (html2canvas)"
              >
                📷 Descargar Todas
              </button> */}
              <button
                onClick={downloadAllTablesV2}
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
                  <div className="flex gap-2">
                    {/* <button
                      onClick={() => downloadAsImage(gameweekPointsRef.current, `${gameweek.description}-puntos-fecha`)}
                      className="btn btn-secondary text-sm"
                      title="Descargar (html2canvas)"
                    >
                      📷
                    </button> */}
                    <button
                      onClick={() => downloadAsImageV2(gameweekPointsRef.current, `${gameweek.description}-puntos-fecha`)}
                      className="btn btn-secondary text-sm"
                      title="Descargar como imagen"
                    >
                      📷
                    </button>
                  </div>
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
                <div className="flex gap-2">
                  {/* <button
                    onClick={() => downloadAsImage(tournamentPointsRef.current, `${gameweek.description}-puntos-torneo`)}
                    className="btn btn-secondary text-sm"
                    title="Descargar (html2canvas)"
                  >
                    📷
                  </button> */}
                  <button
                    onClick={() => downloadAsImageV2(tournamentPointsRef.current, `${gameweek.description}-puntos-torneo`)}
                    className="btn btn-secondary text-sm"
                    title="Descargar como imagen"
                  >
                    📷
                  </button>
                </div>
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
        </div>
      )}
    </div>
  )
}
