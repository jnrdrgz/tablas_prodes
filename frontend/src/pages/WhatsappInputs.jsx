import { useState, useEffect } from 'react'
import * as api from '../api'

export default function WhatsappInputs() {
  const [inputs, setInputs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewingId, setViewingId] = useState(null)
  const [viewingText, setViewingText] = useState('')

  useEffect(() => {
    loadInputs()
  }, [])

  async function loadInputs() {
    try {
      setLoading(true)
      const data = await api.getWhatsappInputs()
      setInputs(data)
      console.log('[WHATSAPP_INPUTS] Loaded inputs:', data.length)
    } catch (err) {
      console.error('[WHATSAPP_INPUTS] Error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleView(id) {
    if (viewingId === id) {
      setViewingId(null)
      setViewingText('')
      return
    }

    try {
      const data = await api.getWhatsappInput(id)
      setViewingId(id)
      setViewingText(data.rawText)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Eliminar este input?')) return

    try {
      await api.deleteWhatsappInput(id)
      setViewingId(null)
      setViewingText('')
      loadInputs()
    } catch (err) {
      setError(err.message)
    }
  }

  function formatDate(dateStr) {
    const date = new Date(dateStr)
    return date.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) return <div className="text-center py-8">Cargando...</div>

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Historial de Inputs WhatsApp</h1>

      {error && (
        <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded mb-4">
          {error}
          <button onClick={() => setError('')} className="float-right">&times;</button>
        </div>
      )}

      {inputs.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-gray-400">No hay inputs guardados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {inputs.map(input => (
            <div key={input.id} className="card">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-gray-400 text-sm">{formatDate(input.createdAt)}</span>
                  <span className="mx-2">-</span>
                  <span className="font-medium">{input.tournament?.description || 'Torneo eliminado'}</span>
                  {input.gameweekId && (
                    <span className="text-gray-400 text-sm ml-2">(Fecha #{input.gameweekId})</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleView(input.id)}
                    className="btn btn-secondary text-sm"
                  >
                    {viewingId === input.id ? 'Ocultar' : 'Ver'}
                  </button>
                  <button
                    onClick={() => handleDelete(input.id)}
                    className="btn btn-danger text-sm"
                  >
                    X
                  </button>
                </div>
              </div>

              {viewingId === input.id && (
                <div className="mt-4 p-3 bg-gray-900 rounded max-h-64 overflow-y-auto">
                  <pre className="text-xs whitespace-pre-wrap font-mono">{viewingText}</pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
