'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { errorMessage } from '@/lib/api';
import { ROLE_HOME } from '@/lib/routes';
import { useAuthStore } from '@/store/auth';
import styles from './login.module.css';

/** Only same-site paths under /platform are honoured as a post-login destination. */
function safeNext(next: string | null): string | null {
  return next && next.startsWith('/platform') && !next.startsWith('//') ? next : null;
}

function LoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    try {
      const user = await login(email, password);
      router.replace(next ?? ROLE_HOME[user.role]);
    } catch (err) {
      setError(errorMessage(err, 'Login failed'));
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <label className={styles.field}>
        <span>Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </label>

      <label className={styles.field}>
        <span>Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>

      {error && <p className={styles.error} role="alert">{error}</p>}

      <button type="submit" className={styles.btn} disabled={isLoading}>
        {isLoading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <span className={styles.mark} />
          ASTEAI
        </div>
        <h1 className={styles.title}>Sign in</h1>
        {/* useSearchParams needs a Suspense boundary for static rendering. */}
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
