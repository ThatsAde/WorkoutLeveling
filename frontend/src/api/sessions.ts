import { get, post, put, del } from './client.js';
import type { Session, SessionSet, ApiResponse, PaginatedResponse } from '../types/index.js';

export function listSessions(params?: {
  from?: string;
  to?: string;
  workout_id?: number;
  page?: number;
  limit?: number;
}) {
  return get<PaginatedResponse<Session>>('/sessions', params as Record<string, string | number>);
}

export function getSession(id: number) {
  return get<ApiResponse<Session>>(`/sessions/${id}`);
}

export function startSession(data: { workout_id?: number; name?: string; started_at?: string }) {
  return post<ApiResponse<Session>>('/sessions', data);
}

export function updateSession(id: number, data: {
  ended_at?: string;
  notes?: string;
  overall_rpe?: number;
  name?: string;
}) {
  return put<ApiResponse<Session>>(`/sessions/${id}`, data);
}

export function deleteSession(id: number) {
  return del(`/sessions/${id}`);
}

export function logSet(sessionId: number, data: {
  exercise_id: number;
  set_number: number;
  reps?: number | null;
  duration_s?: number | null;
  weight?: number | null;
  rpe?: number | null;
  notes?: string;
  completed?: boolean;
}) {
  return post<ApiResponse<SessionSet>>(`/sessions/${sessionId}/sets`, data);
}

export function updateSet(sessionId: number, setId: number, data: Partial<SessionSet>) {
  return put<ApiResponse<SessionSet>>(`/sessions/${sessionId}/sets/${setId}`, data);
}

export function deleteSet(sessionId: number, setId: number) {
  return del(`/sessions/${sessionId}/sets/${setId}`);
}
