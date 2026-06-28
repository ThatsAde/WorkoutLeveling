import { get, post, put, del, upload } from './client.js';
import type { Exercise, Muscle, PaginatedResponse, ApiResponse } from '../types/index.js';

export interface UploadedMedia {
  url: string;
  type: 'image' | 'video';
  mime: string;
}

export function uploadExerciseMedia(file: File) {
  return upload<UploadedMedia>('/exercises/upload-media', file);
}

export interface ExerciseFilters {
  search?: string;
  movement_type?: string;
  difficulty?: number;
  is_weighted?: number;
  page?: number;
  limit?: number;
}

export function listExercises(filters: ExerciseFilters = {}) {
  return get<PaginatedResponse<Exercise>>('/exercises', filters as Record<string, string | number>);
}

export function getExercise(id: number) {
  return get<ApiResponse<Exercise>>(`/exercises/${id}`);
}

export type ExercisePayload = Omit<Partial<Exercise>, 'muscles' | 'tendons'> & {
  muscles?: { id: number; role: string }[];
  tendons?: string[];
};

export function createExercise(data: ExercisePayload) {
  return post<ApiResponse<Exercise>>('/exercises', data);
}

export function updateExercise(id: number, data: ExercisePayload) {
  return put<ApiResponse<Exercise>>(`/exercises/${id}`, data);
}

export function deleteExercise(id: number) {
  return del(`/exercises/${id}`);
}

export function listMuscles() {
  return get<ApiResponse<Muscle[]>>('/muscles');
}

export function listMovementTypes() {
  return get<ApiResponse<{ id: number; name: string }[]>>('/movement-types');
}

export function listWorkoutCategories() {
  return get<ApiResponse<{ id: number; name: string }[]>>('/workout-categories');
}
