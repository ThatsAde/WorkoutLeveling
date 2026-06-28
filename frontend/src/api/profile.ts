import { get, put, upload } from './client.js';
import type { User } from '../types/index.js';

export interface ProfileUpdatePayload {
  bio?: string;
  email?: string;
  current_password?: string;
  new_password?: string;
  tutorial_completed?: boolean;
}

export function getProfile() {
  return get<{ data: User }>('/profile');
}

export function updateProfile(payload: ProfileUpdatePayload) {
  return put<{ data: User }>('/profile', payload);
}

export function uploadPfp(file: File) {
  return upload<{ data: { pfp_url: string } }>('/profile/pfp', file);
}

export function getPublicProfile(username: string) {
  return get<{ data: Pick<User, 'id' | 'username' | 'pfp_url' | 'bio' | 'created_at'> }>(`/profile/${username}`);
}

export function requestEmailVerification() {
  return fetch('/api/auth/verify-email/request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(localStorage.getItem('auth_token') ? { Authorization: `Bearer ${localStorage.getItem('auth_token')}` } : {}),
    },
    credentials: 'include',
  });
}

export function confirmEmailVerification(token: string) {
  return fetch('/api/auth/verify-email/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
    credentials: 'include',
  });
}
