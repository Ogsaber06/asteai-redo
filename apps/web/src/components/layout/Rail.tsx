'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { UserRole } from '@asteai/types';
import styles from './Rail.module.css';

const NAV: Record<UserRole, Array<[string, Array<[string, string]>]>> = {
  Employer: [
    ['Hire & ATS', [
      ['requisitions', 'Requisitions'],
      ['pipeline', 'Applications Pipeline'],
      ['interviews', 'Interviews & Offers'],
      ['pools', 'Talent CRM'],
      ['outreach', 'Bulk Outreach'],
    ]],
    ['Intelligence', [
      ['analytics', 'Analytics & Fairness'],
      ['integrity', 'Integrity Queue'],
    ]],
    ['Account', [
      ['billing', 'Billing & Credits'],
      ['team', 'Team & Roles'],
      ['verify', 'Verify a Passport'],
    ]],
  ],
  Candidate: [
    ['Careers & AI Prep', [
      ['applications', 'My Applications'],
      ['assess', 'Take Assessment'],
      ['passport', 'Talent Passport'],
      ['certificates', 'Certificates'],
      ['studio', 'AI Interview Studio'],
    ]],
    ['Account', [
      ['privacy', 'Privacy & Consent'],
      ['verify', 'Verify a Passport'],
    ]],
  ],
  Freelancer: [
    ['Marketplace', [
      ['market', 'Find Projects'],
      ['proposals', 'My Proposals'],
      ['contracts', 'Escrow Contracts'],
      ['wallet', 'Wallet'],
      ['passport', 'Talent Passport'],
    ]],
    ['Account', [
      ['privacy', 'Privacy & Consent'],
    ]],
  ],
  Buyer: [
    ['Talent Sourcing', [
      ['experts', 'Find Experts'],
      ['projects', 'My Projects'],
      ['services', 'Pre-Packaged Services'],
      ['contracts', 'Escrow Contracts'],
      ['wallet', 'Wallet'],
      ['disputes', 'Disputes'],
    ]],
    ['Account', [
      ['verify', 'Verify a Passport'],
    ]],
  ],
  Admin: [
    ['Master Control', [
      ['admin', 'Master Control'],
      ['tenants', 'Tenants & Plans'],
      ['integrity', 'Integrity Review'],
      ['trust', 'Trust & Safety'],
      ['disputes', 'Disputes & Appeals'],
      ['flags', 'Feature Flags'],
      ['auditlog', 'Audit Log'],
    ]],
    ['Growth & Marketing', [
      ['mkt/studio', 'Ad Studio'],
      ['mkt/campaigns', 'Campaigns'],
      ['mkt/audiences', 'Audiences'],
      ['mkt/report', 'Performance'],
    ]],
  ],
};

interface Props {
  role?: UserRole;
}

export function Rail({ role }: Props) {
  const pathname = usePathname();
  const sections = role ? NAV[role] : [];

  return (
    <nav className={styles.rail}>
      {sections.map(([group, items]) => (
        <div key={group}>
          <div className={styles.group}>{group}</div>
          {items.map(([slug, label]) => {
            const href = `/platform/${slug}`;
            const active = pathname.startsWith(href);
            return (
              <Link
                key={slug}
                href={href}
                className={`${styles.link} ${active ? styles.active : ''}`}
              >
                {label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
