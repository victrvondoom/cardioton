import { useCallback, useEffect, useState } from 'react'
import { api } from './cv_risk_viz_prediction__src_api__client'
import type { HealthStatus, MetricsResponse, SchemaResponse } from '../types/cv_risk_viz_prediction__src_types__api'

export function useHealth() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setHealth(await api.health())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'backend unreachable')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])
  return { health, error, loading, reload: load }
}

export function useSchema(auto = true) {
  const [schema, setSchema] = useState<SchemaResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setSchema(await api.schema())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'backend unreachable')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (auto) void load() }, [auto, load])
  return { schema, error, loading, reload: load }
}

export function useMetrics() {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setMetrics(await api.metrics())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'backend unreachable')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])
  return { metrics, error, loading, reload: load }
}
