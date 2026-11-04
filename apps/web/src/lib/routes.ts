import type { UserRole } from '@asteai/types';

export const LOGIN_PATH = '/auth/login';

/** Where each role lands after sign-in. Every target must be a built page. */
export const ROLE_HOME: Record<UserRole, string> = {
  Employer: '/platform/requisitions',
  Candidate: '/platform/applications',
  Freelancer: '/platform/passport',
  Buyer: '/platform/projects',
  Admin: '/platform/admin',
};

export interface NavItem {
  slug: string;
  label: string;
  /** False for sections whose page has not been built yet: shown, but not linked. */
  ready?: boolean;
}

export type NavSection = [group: string, items: NavItem[]];

const item = (slug: string, label: string, ready = false): NavItem => ({ slug, label, ready });

export const NAV: Record<UserRole, NavSection[]> = {
  Employer: [
    ['Hire & ATS', [
      item('requisitions', 'Requisitions', true),
      item('pipeline', 'Applications Pipeline'),
      item('interviews', 'Interviews & Offers'),
      item('pools', 'Talent CRM'),
      item('outreach', 'Bulk Outreach'),
    ]],
    ['Intelligence', [
      item('analytics', 'Analytics & Fairness'),
      item('integrity', 'Integrity Queue'),
    ]],
    ['Account', [
      item('billing', 'Billing & Credits'),
      item('team', 'Team & Roles'),
      item('verify', 'Verify a Passport'),
    ]],
  ],
  Candidate: [
    ['Careers & AI Prep', [
      item('applications', 'My Applications', true),
      item('assess', 'Take Assessment', true),
      item('passport', 'Talent Passport', true),
      item('certificates', 'Certificates', true),
      item('studio', 'AI Interview Studio', true),
    ]],
    ['Account', [
      item('privacy', 'Privacy & Consent'),
      item('verify', 'Verify a Passport'),
    ]],
  ],
  Freelancer: [
    ['Marketplace', [
      item('market', 'Find Projects'),
      item('proposals', 'My Proposals'),
      item('contracts', 'Escrow Contracts'),
      item('wallet', 'Wallet'),
      item('passport', 'Talent Passport', true),
    ]],
    ['Account', [
      item('privacy', 'Privacy & Consent'),
    ]],
  ],
  Buyer: [
    ['Talent Sourcing', [
      item('experts', 'Find Experts'),
      item('projects', 'My Projects', true),
      item('services', 'Pre-Packaged Services'),
      item('contracts', 'Escrow Contracts'),
      item('wallet', 'Wallet'),
      item('disputes', 'Disputes'),
    ]],
    ['Account', [
      item('verify', 'Verify a Passport'),
    ]],
  ],
  Admin: [
    ['Master Control', [
      item('admin', 'Master Control', true),
      item('ai-interviews', 'AI Interviews', true),
      item('assessment-sessions', 'Assessment Sessions', true),
      item('tenants', 'Tenants & Plans'),
      item('integrity', 'Integrity Review'),
      item('trust', 'Trust & Safety'),
      item('disputes', 'Disputes & Appeals'),
      item('flags', 'Feature Flags'),
      item('auditlog', 'Audit Log'),
    ]],
    ['Growth & Marketing', [
      item('mkt/studio', 'Ad Studio'),
      item('mkt/campaigns', 'Campaigns'),
      item('mkt/audiences', 'Audiences'),
      item('mkt/report', 'Performance'),
    ]],
  ],
};
