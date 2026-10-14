// Centralized API client. Production uses same-origin '/api' (Vercel rewrite);
// dev can override with VITE_API_BASE.
const BASE = import.meta.env.VITE_API_BASE ?? ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail ?? body)
    } catch { /* keep statusText */ }
    throw new Error(`API ${res.status}: ${detail}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  health: () => request<import('../types/cv_risk_viz_prediction__src_types__api').HealthStatus>('/api/health'),
  schema: () => request<import('../types/cv_risk_viz_prediction__src_types__api').SchemaResponse>('/api/schema'),
  models: () => request<import('../types/cv_risk_viz_prediction__src_types__api').ModelsResponse>('/api/models'),
  metrics: () => request<import('../types/cv_risk_viz_prediction__src_types__api').MetricsResponse>('/api/metrics'),
  predict: (features: Record<string, unknown>) =>
    request<import('../types/cv_risk_viz_prediction__src_types__api').PredictResponse>('/api/predict', {
      method: 'POST',
      body: JSON.stringify({ features }),
    }),
  explain: (features: Record<string, unknown>, target: string) =>
    request<import('../types/cv_risk_viz_prediction__src_types__api').ExplainResponse>('/api/explain', {
      method: 'POST',
      body: JSON.stringify({ features, target }),
    }),
}
