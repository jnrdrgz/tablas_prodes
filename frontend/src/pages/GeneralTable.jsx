import { useState, useEffect } from 'react'
import { getGeneralTable } from '../api'

export default function GeneralTable() {
  const [table, setTable] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadTable()
  }, [])

  const loadTable = async () => {
    try {
      setLoading(true)
      const data = await getGeneralTable()
      setTable(data)
    } catch (err) {
      console.error('[GENERAL TABLE] Error loading:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="text-center py-8 text-gray-400">Cargando tabla general...</div>
  if (error) return <div className="text-center py-8 text-red-400">Error: {error}</div>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Tabla General</h1>

      {!table || table.length === 0 ? (
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
                <th>Torneos</th>
                <th>Fechas</th>
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
                  <td>{p.torneos}</td>
                  <td>{p.fechas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
