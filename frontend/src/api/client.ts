import { API_BASE } from '../config.js';
import type { ApiError } from '../types/index.js';

export class ApiException extends Error {
  constructor(public readonly error: ApiError, public readonly status: number) {
    super(error.message);
  }
}

const BASE = API_BASE;

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...options.headers,
    },
    ...options,
  });

  if (res.status === 204) return undefined as T;

  const json = await res.json();

  if (!res.ok) {
    if (res.status === 401) {
      window.location.hash = '#/login';
      throw new ApiException(json.error ?? { code: 'UNAUTHORIZED', message: 'Unauthorized' }, 401);
    }
    throw new ApiException(json.error ?? { code: 'ERROR', message: 'Unknown error' }, res.status);
  }

  return json as T;
}

export function get<T>(path: string, params?: Record<string, string | number | undefined>) {
  let url = path;
  if (params) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') q.set(k, String(v));
    }
    const qs = q.toString();
    if (qs) url += '?' + qs;
  }
  return request<T>(url);
}

export function post<T>(path: string, body: unknown) {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

export function put<T>(path: string, body: unknown) {
  return request<T>(path, { method: 'PUT', body: JSON.stringify(body) });
}

export function del(path: string) {
  return request<void>(path, { method: 'DELETE' });
}

/**
 * Upload a file via multipart/form-data. Browser auto-sets Content-Type with boundary.
 */
export async function upload<T>(path: string, file: File, fieldName = 'file'): Promise<T> {
  const fd = new FormData();
  fd.append(fieldName, file);
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders(),
    body: fd,
  });
  if (res.status === 204) return undefined as T;
  const json = await res.json();
  if (!res.ok) {
    if (res.status === 401) {
      window.location.hash = '#/login';
      throw new ApiException(json.error ?? { code: 'UNAUTHORIZED', message: 'Unauthorized' }, 401);
    }
    throw new ApiException(json.error ?? { code: 'ERROR', message: 'Upload failed' }, res.status);
  }
  return json as T;
}
