'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import styles from './Sourcing.module.css';

const BUYER = [
  { href: '/platform/sourcing', label: 'Find Top Experts', exact: true },
  { href: '/platform/sourcing/services', label: 'Pre-Packaged Services' },
  { href: '/platform/sourcing/orders', label: 'Active Orders' },
  { href: '/platform/sourcing/contracts', label: 'Projects & Escrow' },
] as const;

const EXPERT = [
  { href: '/platform/sourcing/orders', label: 'Active Orders' },
  { href: '/platform/sourcing/contracts', label: 'Escrow Contracts' },
] as const;

export function SourcingTabs() {
  const pathname = usePathname();
  const isExpert = useAuthStore((s) => s.user?.role === 'Freelancer');
  const tabs = isExpert ? EXPERT : BUYER;
  return (
    <nav className={styles.tabs} aria-label="Sourcing">
      {tabs.map((t) => {
        const active = 'exact' in t && t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link key={t.href} href={t.href} className={active ? `${styles.tab} ${styles.tabActive}` : styles.tab} aria-current={active ? 'page' : undefined}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
