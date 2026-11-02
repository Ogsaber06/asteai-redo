'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import type { UserRole } from '@asteai/types';

const HOME: Record<UserRole, string> = {
  Employer:  '/platform/requisitions',
  Candidate: '/platform/applications',
  Freelancer:'/platform/market',
  Buyer:     '/platform/projects',
  Admin:     '/platform/admin',
};

export function DashboardRedirect() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) {
      router.replace('/auth/login');
    } else {
      router.replace(HOME[user.role] ?? '/platform');
    }
  }, [user, router]);

  return null;
}
