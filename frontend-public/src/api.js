const API_BASE = '/api'

async function request(path) {
  const url = `${API_BASE}${path}`
  console.log(`[API] GET ${url}`)

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json'
    }
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

// Read-only endpoints
export const getTournaments = () => request('/tournaments')
export const getTournament = (id) => request(`/tournaments/${id}`)
export const getGameweek = (id) => request(`/gameweeks/${id}`)
export const getGameweekPoints = (id) => request(`/gameweeks/${id}/points`)
export const getGeneralTable = () => request('/general-table')
