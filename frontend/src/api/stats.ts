import { get } from './client.js';
import type {
  ApiResponse,
  StatVolume,
  StatFrequency,
  StatProgression,
  StatCalendar,
  StatSummary,
} from '../types/index.js';

export function getVolume(params?: {
  exercise_id?: number;
  from?: string;
  to?: string;
  group_by?: 'day' | 'week' | 'month';
}) {
  return get<ApiResponse<StatVolume[]>>('/stats/volume', params as Record<string, string | number>);
}

export function getFrequency(params?: { from?: string; to?: string }) {
  return get<ApiResponse<StatFrequency[]>>('/stats/frequency', params as Record<string, string | number>);
}

export function getProgression(params: {
  exercise_id: number;
  metric?: 'max_weight' | 'max_reps' | 'total_reps' | 'volume';
  from?: string;
  to?: string;
}) {
  return get<ApiResponse<{ exercise: { name: string }; metric: string; data: StatProgression[] }>>(
    '/stats/progression',
    params as Record<string, string | number>
  );
}

export function getCalendar(params?: { year?: number; month?: number }) {
  return get<ApiResponse<StatCalendar[]>>('/stats/calendar', params as Record<string, string | number>);
}

export function getSummary(params?: { days?: number }) {
  return get<ApiResponse<StatSummary>>('/stats/summary', params as Record<string, string | number>);
}
