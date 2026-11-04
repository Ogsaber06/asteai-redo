'use client';

/**
 * Auth store (Zustand). Holds the signed-in user; tokens live in lib/tokens.
 * Only `user` is persisted, so a reload keeps the session without a round trip.
 */
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@asteai/types';
import { api, setSessionExpiredHandler } from '@/lib/api';
import { tokenStorage } from '@/lib/tokens';

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: false,

      async login(email, password) {
        set({ isLoading: true });
        try {
          const res = await api.post<LoginResponse>('/auth/login', { email, password });
          tokenStorage.set({ accessToken: res.accessToken, refreshToken: res.refreshToken, userId: res.user.id });
          set({ user: res.user });
          return res.user;
        } finally {
          set({ isLoading: false });
        }
      },

      async logout() {
        try {
          await api.post('/auth/logout');
        } catch {
          // The server session may already be gone; sign out locally regardless.
        }
        tokenStorage.clear();
        set({ user: null });
      },

      async refreshUser() {
        try {
          set({ user: await api.get<User>('/users/me') });
        } catch {
          // Leave the cached user; a 401 is handled by the session-expired handler.
        }
      },

      clearSession() {
        tokenStorage.clear();
        set({ user: null });
      },
    }),
    {
      name: 'asteai-auth',
      partialize: (s) => ({ user: s.user }),
    },
  ),
);

/**
 * False during server render and the first client render, true once the persisted
 * user has been read. Gate anything that depends on `user` on it to avoid hydration
 * mismatches and premature redirects.
 */
export function useAuthHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
    if (useAuthStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);
  return hydrated;
}

// When a refresh fails, drop the cached user so the shell's guard sends the user to sign in.
setSessionExpiredHandler(() => useAuthStore.getState().clearSession());
