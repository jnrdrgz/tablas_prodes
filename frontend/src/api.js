const API_BASE = '/api'

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`
  console.log(`[API] ${options.method || 'GET'} ${url}`)

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    console.error(`[API] Error:`, error)
    throw new Error(error.error || 'Request failed')
  }

  const data = await response.json()
  console.log(`[API] Response:`, data)
  return data
}

// Tournaments
export const getTournaments = () => request('/tournaments')
export const getTournament = (id) => request(`/tournaments/${id}`)
export const createTournament = (data) => request('/tournaments', {
  method: 'POST',
  body: JSON.stringify(data)
})
export const updateTournament = (id, data) => request(`/tournaments/${id}`, {
  method: 'PUT',
  body: JSON.stringify(data)
})
export const deleteTournament = (id) => request(`/tournaments/${id}`, { method: 'DELETE' })

// Gameweeks
export const getGameweek = (id) => request(`/gameweeks/${id}`)
export const getGameweekPoints = (id) => request(`/gameweeks/${id}/points`)
export const createGameweek = (data) => request('/gameweeks', {
  method: 'POST',
  body: JSON.stringify(data)
})
export const deleteGameweek = (id) => request(`/gameweeks/${id}`, { method: 'DELETE' })

// Matches
export const createMatchesBulk = (gameweekId, matchesText) => request('/matches/bulk', {
  method: 'POST',
  body: JSON.stringify({ gameweekId, matchesText })
})
export const updateMatchResult = (id, result) => request(`/matches/${id}/result`, {
  method: 'PUT',
  body: JSON.stringify({ result })
})
export const updateResultsBulk = (gameweekId, resultsText) => request('/matches/bulk-results', {
  method: 'PUT',
  body: JSON.stringify({ gameweekId, resultsText })
})

// Predictions
export const uploadPredictionsBulk = (gameweekId, whatsappText) => request('/predictions/bulk', {
  method: 'POST',
  body: JSON.stringify({ gameweekId, whatsappText })
})
export const deleteGameweekPredictions = (gameweekId) => request(`/predictions/gameweek/${gameweekId}`, {
  method: 'DELETE'
})

// Mappings
export const getMappings = () => request('/mappings')
export const createMapping = (key, value) => request('/mappings', {
  method: 'POST',
  body: JSON.stringify({ key, value })
})
export const deleteMapping = (id) => request(`/mappings/${id}`, { method: 'DELETE' })

// Debug
export const debugParsePreview = (whatsappText) => request('/debug/parse-preview', {
  method: 'POST',
  body: JSON.stringify({ whatsappText })
})

// WhatsApp Inputs
export const getWhatsappInputs = () => request('/whatsapp-inputs')
export const getWhatsappInput = (id) => request(`/whatsapp-inputs/${id}`)
export const deleteWhatsappInput = (id) => request(`/whatsapp-inputs/${id}`, { method: 'DELETE' })
