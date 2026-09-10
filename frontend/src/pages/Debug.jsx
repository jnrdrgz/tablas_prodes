import { useState } from 'react'
import * as api from '../api'

const PLACEHOLDERS = {
  whatsapp: `[1/21, 21:39] PMolina: Aldosivi 1-1 Defensa
Banfield 0-2 Huracán
Unión 1-1 Platense
[1/21, 23:13] +54 9 381 574-8792: Aldosivi 1-0 Defensa
Banfield 0-0 Huracán
...`,
  wpweb: `[15:19, 9/4/2026] Juan Rodríguez: Estudiantes RC 0-1 Sarmiento
Belgrano 1-0 Huracán
[16:17, 9/4/2026] +54 9 3512 87-0987: Estudiantes RC 0-0 Sarmiento
Belgrano 1-0 Huracán
...`
}

export default function Debug() {
  const [whatsappText, setWhatsappText] = useState('')
  const [format, setFormat] = useState('whatsapp')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleTest() {
    if (!whatsappText.trim()) return

    try {
      setLoading(true)
      setError('')
      console.log(`[DEBUG] Testing parser (format=${format})`)
      const data = await api.debugParsePreview(whatsappText, format)
      setResult(data)
      console.log('[DEBUG] Parse result:', data)
    } catch (err) {
      console.error('[DEBUG] Error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Debug - Parser de WhatsApp</h1>

      <div className="card mb-6">
        <h2 className="text-xl font-bold mb-4">Probar Parser</h2>
        <p className="text-sm text-gray-400 mb-4">
          Pega el texto de WhatsApp para ver como se parsearia sin guardarlo en la base de datos.
        </p>

        <label className="flex items-center gap-2 mb-4 text-sm">
          Parser:
          <select
            value={format}
            onChange={(e) => { setFormat(e.target.value); setResult(null) }}
            className="input w-auto text-sm"
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="wpweb">WP Web</option>
          </select>
        </label>

        <textarea
          value={whatsappText}
          onChange={(e) => setWhatsappText(e.target.value)}
          className="textarea h-64 mb-4 font-mono text-xs"
          placeholder={PLACEHOLDERS[format]}
        />

        <button
          onClick={handleTest}
          disabled={loading}
          className="btn btn-primary"
        >
          {loading ? 'Parseando...' : 'Probar Parser'}
        </button>
      </div>

      {error && (
        <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {result && (
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Resultado del Parser</h2>
          <p className="text-sm text-gray-400 mb-4">
            Mapeos usados: {result.mappingsUsed}
          </p>

          {result.warnings?.length > 0 && (
            <div className="bg-yellow-900 border border-yellow-700 text-yellow-100 px-4 py-3 rounded mb-4">
              <p className="font-bold mb-1">
                Resultados con doble digito ({result.warnings.length}) - la carga se va a rechazar hasta corregirlos:
              </p>
              <ul className="list-disc list-inside text-sm">
                {result.warnings.map((w, i) => <li key={i}>{w.message}</li>)}
              </ul>
            </div>
          )}

          {result.parsed.length === 0 ? (
            <p className="text-yellow-400">No se encontraron predicciones en el texto</p>
          ) : (
            <div className="space-y-4">
              {result.parsed.map((p, i) => (
                <div key={i} className="bg-gray-700 p-4 rounded">
                  <h3 className="font-bold text-lg text-blue-400 mb-2">
                    {p.predictor}
                  </h3>
                  <div className="text-sm">
                    <span className="text-gray-400">Resultados ({p.results.length}):</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {p.results.map((r, j) => (
                        <span
                          key={j}
                          className="px-2 py-1 bg-gray-600 rounded font-mono"
                        >
                          {j + 1}. {r}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 p-4 bg-gray-900 rounded">
            <h3 className="font-bold mb-2">JSON Raw:</h3>
            <pre className="text-xs overflow-x-auto">
              {JSON.stringify(result.parsed, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
