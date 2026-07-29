// Single place the backend contract lives.
const BASE = import.meta.env.VITE_API_BASE ?? '/api'

async function post(path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`${path} failed (${r.status}). Is the API running on port 8000?`)
  return r.json()
}

export const assess  = (patient) => post('/assess', patient)
export const getMetrics = async () => {
  const r = await fetch(`${BASE}/metrics`)
  if (!r.ok) throw new Error('Could not load metrics. Run: python -m src.models.train')
  return r.json()
}
