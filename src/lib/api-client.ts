'use client'

/**
 * Lightweight API client used by the admin sections.
 *
 * SelfBase endpoints return one of three shapes:
 *   1. A raw array            -> e.g. `/api/tables`
 *   2. A raw object           -> e.g. `/api/tables/[id]`
 *   3. A wrapped response     -> `{ success, data?, error?, meta? }`
 *
 * `apiGet` / `apiSend` normalize all of these so callers can just
 * work with the payload directly.
 */

export interface WrappedResponse<T = unknown> {
  success?: boolean
  data?: T
  error?: string
  meta?: { page: number; limit: number; total: number }
}

function unwrap<T>(value: unknown): T {
  if (value && typeof value === 'object' && 'success' in (value as Record<string, unknown>)) {
    const wrapped = value as WrappedResponse<T>
    if (wrapped.data !== undefined) return wrapped.data as T
    if (wrapped.error) throw new Error(wrapped.error)
  }
  return value as T
}

/** Get the stored auth token from localStorage */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem('sb_auth_token')
  } catch {
    return null
  }
}

/** Build auth headers for API requests */
function authHeaders(): Record<string, string> {
  const token = getAuthToken()
  if (token) return { Authorization: `Bearer ${token}` }
  return {}
}

export async function apiGet<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Accept: 'application/json', ...authHeaders(), ...(init?.headers ?? {}) },
  })
  const text = await res.text()
  let json: unknown
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    if (!res.ok) throw new Error(`Request failed: ${res.status} ${res.statusText}`)
    throw new Error(text || `Request failed: ${res.status}`)
  }
  if (!res.ok) {
    const wrapped = json as WrappedResponse | { error?: string }
    const message =
      (wrapped && typeof wrapped === 'object' && 'error' in wrapped && wrapped.error) ||
      `Request failed: ${res.status}`
    throw new Error(message as string)
  }
  return unwrap<T>(json)
}

export async function apiSend<T = unknown>(
  url: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown,
  init?: RequestInit,
): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
  const res = await fetch(url, {
    method,
    body: isFormData ? (body as BodyInit) : body !== undefined ? JSON.stringify(body) : undefined,
    headers: {
      Accept: 'application/json',
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...authHeaders(),
      ...(init?.headers ?? {}),
    },
    ...init,
  })
  const text = await res.text()
  let json: unknown
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    if (!res.ok) throw new Error(`Request failed: ${res.status} ${res.statusText}`)
    throw new Error(text || `Request failed: ${res.status}`)
  }
  if (!res.ok) {
    const wrapped = json as WrappedResponse | { error?: string }
    const message =
      (wrapped && typeof wrapped === 'object' && 'error' in wrapped && wrapped.error) ||
      `Request failed: ${res.status}`
    throw new Error(message as string)
  }
  return unwrap<T>(json)
}

export const apiPost = <T = unknown>(url: string, body?: unknown, init?: RequestInit) =>
  apiSend<T>(url, 'POST', body, init)
export const apiPut = <T = unknown>(url: string, body?: unknown, init?: RequestInit) =>
  apiSend<T>(url, 'PUT', body, init)
export const apiDelete = <T = unknown>(url: string, init?: RequestInit) =>
  apiSend<T>(url, 'DELETE', undefined, init)

/** Parse a JSON column from the database (always stored as a string). */
export function parseJsonField<T = unknown>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

/** Format an ISO timestamp as a relative "x ago" string. */
export function formatRelativeTime(input: string | Date | null | undefined): string {
  if (!input) return 'Never'
  const date = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(date.getTime())) return '—'
  const diffMs = Date.now() - date.getTime()
  const sec = Math.round(diffMs / 1000)
  if (sec < 5) return 'just now'
  if (sec < 60) return `${sec}s ago`
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  if (day < 30) return `${day}d ago`
  return date.toLocaleDateString()
}
