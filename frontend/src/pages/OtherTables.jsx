import { useState, useEffect } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { getOtherTables } from '../api'
import GeneralTable from './GeneralTable'

const TABS = [
  { key: 'general', label: 'Tabla General' },
  { key: 'historica', label: 'Tabla Historica' },
  { key: 'sin-plenos', label: 'General sin Plenos' },
  { key: 'plenos-seguidos', label: 'Plenos Seguidos' },
  { key: 'simples-seguidos', label: 'Simples Seguidos' },
  { key: 'puntos-fecha', label: 'Puntos en una Fecha' },
  { key: 'puntos-equipo', label: 'Puntos por Equipo' }
]

const STREAK_RULES = 'Un 9-9 o no mandar prode corta la racha; los partidos sin resultado cargado se saltean.'

const PREDICTOR_COLUMN = { header: 'Participante', value: r => r.predictor, left: true }

const STREAK_COLUMNS = [
  PREDICTOR_COLUMN,
  { header: 'Racha', value: r => r.racha, bold: true },
  { header: 'Desde', value: r => r.desde, left: true },
  { header: 'Hasta', value: r => r.hasta, left: true }
]

// Columns: [{ header, value: row => content, left, bold }]
function RankingTable({ note, rows, columns, showPosition = true }) {
  return (
    <div>
      <p className="text-sm text-gray-400 mb-4">{note}</p>

      {rows.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-gray-400">No hay datos todavía</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-dark">
            <thead>
              <tr>
                {showPosition && <th>Pos</th>}
                {columns.map(c => (
                  <th key={c.header} className={c.left ? 'text-left' : ''}>{c.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  {showPosition && <td>{i + 1}</td>}
                  {columns.map(c => (
                    <td key={c.header} className={`${c.left ? 'text-left font-medium' : ''} ${c.bold ? 'font-bold' : ''}`}>
                      {c.value(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function OtherTableContent({ tab, data }) {
  switch (tab) {
    case 'sin-plenos':
      return (
        <RankingTable
          note="Solo torneos activos. Cada acierto de ganador/empate vale 1 punto, sea pleno o no."
          rows={data.sinPlenos}
          columns={[PREDICTOR_COLUMN, { header: 'Pts', value: r => r.puntos, bold: true }]}
        />
      )
    case 'plenos-seguidos':
      return (
        <RankingTable
          note={`Historico (incluye archivados). Partidos seguidos con resultado exacto. ${STREAK_RULES}`}
          rows={data.plenosSeguidos}
          columns={STREAK_COLUMNS}
        />
      )
    case 'simples-seguidos':
      return (
        <RankingTable
          note={`Historico (incluye archivados). Partidos seguidos acertando al menos ganador/empate (un pleno tambien cuenta). ${STREAK_RULES}`}
          rows={data.simplesSeguidos}
          columns={STREAK_COLUMNS}
        />
      )
    case 'puntos-fecha':
      return (
        <RankingTable
          note="Historico (incluye archivados). La mejor fecha de cada participante."
          rows={data.puntosEnUnaFecha}
          columns={[
            PREDICTOR_COLUMN,
            { header: 'Pts', value: r => r.puntos, bold: true },
            { header: 'Plenos', value: r => r.plenos },
            { header: 'Fecha', value: r => r.fecha, left: true },
            { header: 'Torneo', value: r => r.torneo, left: true }
          ]}
        />
      )
    case 'puntos-equipo':
      return (
        <RankingTable
          note="Historico (incluye archivados). Para cada equipo, quien sumo mas puntos en los partidos de ese equipo. Si hay empate aparecen todos."
          rows={data.puntosPorEquipo}
          showPosition={false}
          columns={[
            { header: 'Equipo', value: r => r.equipo, left: true },
            { header: 'Participante', value: r => r.participantes.join(', '), left: true },
            { header: 'Pts', value: r => r.puntos, bold: true }
          ]}
        />
      )
    default:
      return null
  }
}

export default function OtherTables() {
  const { tab } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const currentTab = TABS.find(t => t.key === tab)
  // Tabla General / Historica load their own data; the rest come from /other-tables
  const needsOtherTables = currentTab && tab !== 'general' && tab !== 'historica'

  useEffect(() => {
    if (needsOtherTables && !data) loadOtherTables()
  }, [needsOtherTables])

  async function loadOtherTables() {
    try {
      setLoading(true)
      setError(null)
      const result = await getOtherTables()
      setData(result)
      console.log('[OTHER TABLES] Loaded other tables')
    } catch (err) {
      console.error('[OTHER TABLES] Error loading:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!currentTab) return <Navigate to="/tablas/general" replace />

  const tabClass = (active) =>
    `px-4 py-2 rounded-t font-medium ${active ? 'bg-gray-800 text-white' : 'bg-gray-900 text-gray-400 hover:text-white'}`

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">{currentTab.label}</h1>

      <div className="flex flex-wrap gap-1 mb-4">
        {TABS.map(t => (
          <Link key={t.key} to={`/tablas/${t.key}`} className={tabClass(t.key === tab)}>
            {t.label}
          </Link>
        ))}
      </div>

      {tab === 'general' && <GeneralTable />}
      {tab === 'historica' && <GeneralTable historic />}

      {needsOtherTables && (
        loading ? (
          <div className="text-center py-8 text-gray-400">Cargando tabla...</div>
        ) : error ? (
          <div className="text-center py-8 text-red-400">Error: {error}</div>
        ) : data && (
          <OtherTableContent tab={tab} data={data} />
        )
      )}
    </div>
  )
}
