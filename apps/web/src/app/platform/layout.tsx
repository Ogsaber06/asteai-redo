import { AppShell } from '@/components/layout/AppShell';

/**
 * The platform shell wraps all authenticated pages.
 * Navigation rail, top bar, and main content area live here.
 */
export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
