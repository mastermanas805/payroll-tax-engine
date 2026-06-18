import type { ApiErrorEnvelope } from './types';

// Base path. In dev, Vite proxies /api -> http://localhost:3000.
// In prod the SPA is served same-origin by NestJS, so /api/v1 resolves directly.
const BASE = '/api/v1';

const TOKEN_KEY = 'payroll.jwt';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/** A structured error thrown by the API client, carrying the server's code. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Callback fired on any 401 so the app can force a logout/redirect.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void): void {
  onUnauthorized = fn;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  /** skip attaching the Authorization header (for login/register). */
  anonymous?: boolean;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

  if (!opts.anonymous) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Check your connection.');
  }

  if (res.status === 401 && !opts.anonymous) {
    onUnauthorized?.();
  }

  if (res.status === 204) return undefined as T;

  let payload: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!res.ok) {
    const envelope = payload as ApiErrorEnvelope | null;
    const code = envelope?.error?.code ?? 'HTTP_ERROR';
    const message = envelope?.error?.message ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, code, message, envelope?.error?.details);
  }

  return payload as T;
}

export const http = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  post: <T>(path: string, body?: unknown, opts: Partial<RequestOptions> = {}) =>
    request<T>(path, { method: 'POST', body, ...opts }),
  patch: <T>(path: string, body?: unknown, opts: Partial<RequestOptions> = {}) =>
    request<T>(path, { method: 'PATCH', body, ...opts }),
  del: <T>(path: string, opts: Partial<RequestOptions> = {}) =>
    request<T>(path, { method: 'DELETE', ...opts }),
};
