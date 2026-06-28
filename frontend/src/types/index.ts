export interface MovementType {
  id: number;
  name: string;
}

export interface Muscle {
  id: number;
  name: string;
  group_name: string;
  body_side: 'left' | 'right' | 'bilateral';
  role?: 'primary' | 'secondary';
}

export interface WorkoutCategory {
  id: number;
  name: string;
}

export interface Exercise {
  id: number;
  name: string;
  movement_type_id: number;
  movement_type_name: string;
  is_weighted: boolean;
  default_weight: number | null;
  difficulty: 1 | 2 | 3 | 4 | 5;
  description: string | null;
  video_url: string | null;
  image_url: string | null;
  is_timed: boolean;
  muscles: Muscle[];
  tendons: string[];
  created_at: string;
  updated_at: string;
}

export interface WorkoutExercise {
  id: number;
  workout_id: number;
  exercise_id: number;
  exercise_name: string;
  is_timed: boolean;
  is_weighted: boolean;
  movement_type_name: string;
  position: number;
  sets: number;
  target_reps: number | null;
  target_time_s: number | null;
  rest_s: number;
  notes: string | null;
}

export interface Workout {
  id: number;
  name: string;
  category_id: number | null;
  category_name: string | null;
  description: string | null;
  estimated_duration_min: number | null;
  exercises: WorkoutExercise[];
  created_at: string;
  updated_at: string;
  exercise_count?: number;
}

export interface SessionSet {
  id: number;
  session_id: number;
  exercise_id: number;
  exercise_name: string;
  is_timed: boolean;
  is_weighted: boolean;
  movement_type_name: string;
  set_number: number;
  reps: number | null;
  duration_s: number | null;
  weight: number | null;
  rpe: number | null;
  notes: string | null;
  completed: boolean;
}

export interface Session {
  id: number;
  workout_id: number | null;
  workout_template_name: string | null;
  name: string | null;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
  overall_rpe: number | null;
  sets: SessionSet[];
  set_count?: number;
  created_at: string;
}

export interface BodyStat {
  id: number;
  recorded_date: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  notes: string | null;
}

export interface ApiError {
  code: string;
  message: string;
  errors?: Record<string, string>;
}

export interface ApiResponse<T> {
  data: T;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

export interface StatVolume {
  period: string;
  exercise_id: number;
  exercise_name: string;
  movement_type: string;
  total_reps: number;
  volume: number;
  session_count: number;
}

export interface StatFrequency {
  muscle_id: number;
  muscle_name: string;
  group_name: string;
  role: 'primary' | 'secondary';
  session_count: number;
  set_count: number;
}

export interface StatProgression {
  date: string;
  value: number;
  set_count: number;
}

export interface StatCalendar {
  date: string;
  session_count: number;
  session_names: string;
}

export interface StatSummary {
  period_days: number;
  sessions: number;
  total_sets: number;
  top_exercises: { name: string; set_count: number }[];
  current_streak: number;
}

export type Page = 'dashboard' | 'exercises' | 'workouts' | 'log' | 'history' | 'body-stats';

export interface User {
  id: number;
  username: string;
  email: string | null;
  email_verified_at: string | null;
  role: 'user' | 'moderator' | 'admin';
  pfp_url: string | null;
  bio: string | null;
  tutorial_completed_at: string | null;
  token?: string;
  created_at?: string;
}
