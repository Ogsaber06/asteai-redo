'use client';

import { useAuthStore } from '@/store/auth';
import { TopBar } from './TopBar';
import { Rail } from './Rail';
import styles from './AppShell.module.css';

interface Props {
  children: React.ReactNode;
}

export function AppShell({ children }: Props) {
  const user = useAuthStore((s) => s.user);

  return (
    <div className={styles.root}>
      <TopBar user={user} />
      <div className={styles.shell}>
        <Rail role={user?.role} />
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
