import { redirect } from 'next/navigation';

/**
 * Root route: redirect to the platform shell.
 * In production this would check the user session cookie.
 */
export default function HomePage() {
  redirect('/platform');
}
