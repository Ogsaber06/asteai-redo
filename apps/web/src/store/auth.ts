/**
 * auth.ts – Auth store using Zustand
 * Persists tokens to localStorage; exposes login/logout actions.
 */
'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';
import type { User } from '@asteai/types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setTokens: (access: string, refresh: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user:         null,
      accessToken:  null,
      refreshToken: null,
      isLoading:    false,

      setTokens(access, refresh) {
        set({ accessToken: access, refreshToken: refresh });
        if (typeof window !== 'undefined') {
          localStorage.setItem('accessToken', access);
          localStorage.setItem('refreshToken', refresh);
        }
      },

      async login(email, password) {
        set({ isLoading: true });
        try {
          const res = await api.post<{ accessToken: string; refreshToken: string; user: User }>(
            '/auth/login',
            { email, password },
          );
          get().setTokens(res.accessToken, res.refreshToken);
          if (typeof window !== 'undefined') {
            localStorage.setItem('userId', res.user.id);
          }
          set({ user: res.user });
        } finally {
          set({ isLoading: false });
        }
      },

      async logout() {
        try {
          await api.post('/auth/logout');
        } catch {}
        set({ user: null, accessToken: null, refreshToken: null });
        ['accessToken', 'refreshToken', 'userId'].forEach(k => localStorage.removeItem(k));
      },

      async refreshUser() {
        try {
          const user = await api.get<User>('/users/me');
          set({ user });
        } catch {}
      },
    }),
    {
      name: 'asteai-auth',
      partialize: (s) => ({
        user:         s.user,
        accessToken:  s.accessToken,
        refreshToken: s.refreshToken,
      }),
    },
  ),
);
