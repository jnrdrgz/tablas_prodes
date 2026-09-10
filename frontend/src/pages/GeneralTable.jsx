import { useState, useEffect } from 'react'
import { getGeneralTable, getHistoricTable } from '../api'

// Tabla General / Tabla Historica, shown as tabs inside Otras Tablas.
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

  return (
    <div>
      <p className="text-sm text-gray-400 mb-4">
        {historic
          ? 'Incluye todos los torneos, tambien los archivados.'
          : 'Solo torneos activos (no incluye archivados).'}
      </p>

      {loading ? (
        <div className="text-center py-8 text-gray-400">Cargando tabla...</div>
      ) : error ? (
        <div className="text-center py-8 text-red-400">Error: {error}</div>
      ) : !table || table.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-gray-400">No hay datos todavía</p>
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
