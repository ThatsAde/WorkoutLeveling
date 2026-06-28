import { get, post, put, del } from './client.js';
import type { Workout, WorkoutExercise, ApiResponse } from '../types/index.js';

export function listWorkouts(params?: { category_id?: number; search?: string }) {
  return get<ApiResponse<Workout[]>>('/workouts', params as Record<string, string | number>);
}

export function getWorkout(id: number) {
  return get<ApiResponse<Workout>>(`/workouts/${id}`);
}

export function createWorkout(data: Partial<Workout> & { exercises?: Partial<WorkoutExercise>[] }) {
  return post<ApiResponse<Workout>>('/workouts', data);
}

export function updateWorkout(id: number, data: Partial<Workout>) {
  return put<ApiResponse<Workout>>(`/workouts/${id}`, data);
}

export function deleteWorkout(id: number) {
  return del(`/workouts/${id}`);
}

export function addExerciseToWorkout(workoutId: number, data: {
  exercise_id: number;
  sets?: number;
  target_reps?: number | null;
  target_time_s?: number | null;
  rest_s?: number;
  notes?: string;
}) {
  return post<ApiResponse<Workout>>(`/workouts/${workoutId}/exercises`, data);
}

export function updateWorkoutExercise(workoutId: number, weId: number, data: Partial<WorkoutExercise>) {
  return put<ApiResponse<Workout>>(`/workouts/${workoutId}/exercises/${weId}`, data);
}

export function removeExerciseFromWorkout(workoutId: number, weId: number) {
  return del(`/workouts/${workoutId}/exercises/${weId}`);
}

export function reorderWorkoutExercises(workoutId: number, items: { id: number; position: number }[]) {
  return put<ApiResponse<Workout>>(`/workouts/${workoutId}/reorder`, items);
}
