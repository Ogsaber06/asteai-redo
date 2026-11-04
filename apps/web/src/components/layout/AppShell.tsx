'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthHydrated, useAuthStore } from '@/store/auth';
import { LOGIN_PATH } from '@/lib/routes';
import { VoiceAssistant } from '@/features/voice-assistant';
import { Rail } from './Rail';
import { TopBar } from './TopBar';
import styles from './AppShell.module.css';

/**
 * Shell for every authenticated page. Waits for the persisted session to load, then
 * sends signed-out visitors to the login page (remembering where they were going).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useAuthHydrated();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (hydrated && !user) {
      router.replace(`${LOGIN_PATH}?next=${encodeURIComponent(pathname)}`);
    }
  }, [hydrated, user, pathname, router]);

  if (!hydrated || !user) {
    return <div className={styles.loading}>Loading…</div>;
  }

  return (
    <div className={styles.root}>
      <TopBar user={user} />
      <div className={styles.shell}>
        <Rail role={user.role} />
        <main className={styles.main}>{children}</main>
      </div>
      <VoiceAssistant role={user.role} />
    </div>
  );
}
