'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { UserRole } from '@asteai/types';
import { errorMessage } from '@/lib/api';
import { ROLE_HOME } from '@/lib/routes';
import { useAuthStore } from '@/store/auth';
import styles from './login.module.css';

/** Only same-site paths under /platform are honoured as a post-login destination. */
function safeNext(next: string | null): string | null {
  return next && next.startsWith('/platform') && !next.startsWith('//') ? next : null;
}

const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'ops@asteai.com', role: 'Admin', desc: 'Master Control' },
  { label: 'Employer', email: 'priya@meridianhospitals.in', role: 'Employer', desc: 'Meridian Hospitals' },
  { label: 'Candidate', email: 'rahul.g@gmail.com', role: 'Candidate', desc: 'Mysuru Nursing' },
  { label: 'Freelancer', email: 'aarav@dev.in', role: 'Freelancer', desc: 'Systems Engineer' },
  { label: 'Buyer', email: 'nikhil@novastack.io', role: 'Buyer', desc: 'NovaStack CTO' },
] as const;

const DEFAULT_DEMO_PASSWORD = 'Password123!';

function AuthForms() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);

  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<UserRole>('Candidate');
  const [error, setError] = useState('');

  async function handleLoginSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    try {
      const user = await login(email, password);
      router.replace(next ?? ROLE_HOME[user.role]);
    } catch (err) {
      setError(errorMessage(err, 'Login failed. Check your email and password.'));
    }
  }

  async function handleRegisterSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    try {
      const user = await register({
        email,
        password,
        firstName,
        lastName,
        role,
      });
      router.replace(next ?? ROLE_HOME[user.role]);
    } catch (err) {
      setError(errorMessage(err, 'Registration failed.'));
    }
  }

  function selectDemoAccount(demoEmail: string) {
    setEmail(demoEmail);
    setPassword(DEFAULT_DEMO_PASSWORD);
    setError('');
  }

  return (
    <>
      <div className={styles.tabs} role="tablist">
        <button
          type="button"
          className={`${styles.tab} ${mode === 'signin' ? styles.tabActive : ''}`}
          onClick={() => { setMode('signin'); setError(''); }}
        >
          Sign in
        </button>
        <button
          type="button"
          className={`${styles.tab} ${mode === 'register' ? styles.tabActive : ''}`}
          onClick={() => { setMode('register'); setError(''); }}
        >
          Create account
        </button>
      </div>

      {mode === 'signin' ? (
        <>
          <div className={styles.demoSection}>
            <div className={styles.demoLabel}>Quick Demo Sign-In (Password: Password123!)</div>
            <div className={styles.demoPills}>
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  className={`${styles.demoPill} ${email === acc.email ? styles.demoPillActive : ''}`}
                  onClick={() => selectDemoAccount(acc.email)}
                  title={`${acc.email} (${acc.desc})`}
                >
                  <span>{acc.label}</span>
                  <span className={styles.demoRole}>{acc.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleLoginSubmit} className={styles.form}>
            <label className={styles.field}>
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@domain.com"
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
                placeholder="••••••••"
                required
              />
            </label>

            {error && <p className={styles.error} role="alert">{error}</p>}

            <button type="submit" className={styles.btn} disabled={isLoading}>
              {isLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </>
      ) : (
        <form onSubmit={handleRegisterSubmit} className={styles.form}>
          <div className={styles.row}>
            <label className={styles.field}>
              <span>First name</span>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </label>
            <label className={styles.field}>
              <span>Last name</span>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </label>
          </div>

          <label className={styles.field}>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@domain.com"
              required
            />
          </label>

          <label className={styles.field}>
            <span>Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
            >
              <option value="Candidate">Candidate (Job seeker)</option>
              <option value="Employer">Employer (Hiring manager)</option>
              <option value="Freelancer">Freelancer (Expert contractor)</option>
              <option value="Buyer">Buyer (Project sponsor)</option>
            </select>
          </label>

          <label className={styles.field}>
            <span>Password (min 8 characters)</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>

          {error && <p className={styles.error} role="alert">{error}</p>}

          <button type="submit" className={styles.btn} disabled={isLoading}>
            {isLoading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
      )}
    </>
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
        <Suspense>
          <AuthForms />
        </Suspense>
      </div>
    </div>
  );
}
