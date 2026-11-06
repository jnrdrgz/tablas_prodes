import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getGeneralTable, getHistoricTable } from '../api'

// historic = true includes archived tournaments
export default function GeneralTable({ historic = false }) {
  const [table, setTable] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadTable()
  }, [historic])

  const loadTable = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = historic ? await getHistoricTable() : await getGeneralTable()
      setTable(data)
      console.log(`[GENERAL TABLE] Loaded ${historic ? 'historica' : 'general'} table`)
    } catch (err) {
      console.error('[GENERAL TABLE] Error loading:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const tabClass = (active) =>
    `px-4 py-2 rounded-t font-medium ${active ? 'bg-gray-800 text-white' : 'bg-brand-950 text-gray-400 hover:text-white'}`

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">
        {historic ? 'Tabla Historica' : 'Tabla General Temporada'}
      </h1>

      <div className="flex gap-1 mb-4">
        <Link to="/general" className={tabClass(!historic)}>Tabla General</Link>
        <Link to="/historica" className={tabClass(historic)}>Tabla Historica</Link>
      </div>

      <p className="text-sm text-gray-400 mb-4">
        {historic
          ? 'Historico completo, incluye torneos archivados.'
          : 'Temporada actual (no incluye torneos archivados).'}
      </p>

      {loading ? (
        <div className="text-center py-8 text-gray-400">Cargando tabla...</div>
      ) : error ? (
        <div className="text-center py-8 text-red-400">Error: {error}</div>
      ) : !table || table.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-gray-400">No hay datos todavia</p>
        </div>
      ) : (
        <div className="card">
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
              {table.map((p, i) => (
                <tr key={p.predictor}>
                  <td>{i + 1}</td>
                  <td className="text-left font-medium">{p.predictor}</td>
                  <td className="font-bold">{p.puntos}</td>
                  <td>{p.plenos}</td>
                  <td>{p.goles}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
