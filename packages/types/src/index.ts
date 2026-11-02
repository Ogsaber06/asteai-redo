// ─── User & Auth ─────────────────────────────────────────────────────────────

export type UserRole = 'Employer' | 'Candidate' | 'Freelancer' | 'Buyer' | 'Admin';

export type AccountStatus = 'active' | 'deactivated' | 'deleted';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  tenantId: string | null;
  title?: string;
  avatarUrl?: string;
  lang?: string;
  accountStatus: AccountStatus;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  industry: string;
  plan: 'Free' | 'Growth' | 'Enterprise' | 'Marketplace' | '—';
  credits: number;
  seats: number;
  domain: string;
  retentionMonths: number;
  ssoEnabled: boolean;
}

// ─── Requisitions & ATS ──────────────────────────────────────────────────────

export type ReqStatus = 'Draft' | 'Open' | 'Paused' | 'Closed' | 'Filled';
export type CandidateTier = 'Technical' | 'Non-Technical' | 'Frontline' | 'Skilled';

export interface WeightConfig {
  iq: number;
  eq: number;
  grit: number;
}

export interface SlaConfig {
  funded: boolean;
  start: number | null;
  paused: number;
  delivered: number | null;
}

export interface Requisition {
  id: string;
  tenantId: string;
  title: string;
  industry: string;
  func: string;
  ech: number;
  tier: CandidateTier;
  weights: WeightConfig;
  lang: string;
  location: string;
  headcount: number;
  minShortlist: number;
  threshold: number;
  status: ReqStatus;
  sla: SlaConfig;
  createdAt: string;
  ownerId: string;
  stack: string[];
}

export type ApplicationStage =
  | 'Applied'
  | 'Eligibility'
  | 'Assessment Pending'
  | 'Assessment Review'
  | 'Shortlisted'
  | 'Interview'
  | 'Offer'
  | 'Joined'
  | 'Rejected';

export interface HistoryEntry {
  t: number;
  stage: ApplicationStage;
  by: string;
}

export interface InterviewInfo {
  t: number;
  panel: string;
  kit: string;
}

export interface OfferInfo {
  t: number;
  status: 'Sent' | 'Accepted' | 'Declined';
  ctc: string;
}

export interface Application {
  id: string;
  candidateId: string;
  requisitionId: string;
  tenantId: string;
  stage: ApplicationStage;
  t: number;
  resultId: string | null;
  notes: string[];
  scorecards: Scorecard[];
  interview: InterviewInfo | null;
  offer: OfferInfo | null;
  history: HistoryEntry[];
}

export interface Scorecard {
  id: string;
  by: string;
  score: number;
  note: string;
  t: number;
}

// ─── Assessment ───────────────────────────────────────────────────────────────

export interface StenScores {
  iq: number;
  eq: number;
  grit: number;
}

export interface ThetaScores {
  iq: number;
  eq: number;
  grit: number;
}

export interface AssessmentResult {
  id: string;
  candidateId: string;
  requisitionId: string;
  theta: ThetaScores;
  sten: StenScores;
  fitScore: number;
  ci: number;
  integrity: 'Clear' | 'Review';
  integ: {
    blur: number;
    paste: number;
    fast: number;
  };
  n: { iq: number; eq: number; grit: number };
  durationSeconds: number;
  date: number;
  ev: unknown;
  self: unknown;
  safety: unknown;
  sealed: boolean;
  hash: string;
}

// ─── Talent Passport ─────────────────────────────────────────────────────────

export type PassportStatus = 'Valid' | 'Expired' | 'Revoked';

export interface Passport {
  id: string;
  userId: string;
  name: string;
  tier: CandidateTier;
  scores: Array<[string, number]>;
  sten: StenScores;
  percentile: number;
  hash: string;
  issuedAt: number;
  validUntil: number;
  status: PassportStatus;
  share: {
    discoverable: boolean;
    showIdentity: boolean;
  };
  verifications: Array<{ t: number; by: string }>;
}

// ─── Projects & Marketplace ──────────────────────────────────────────────────

export type ProjectStage =
  | 'Open for Bids'
  | 'Shortlisting'
  | 'Contracted'
  | 'In Progress'
  | 'Milestone Submitted'
  | 'Completed'
  | 'Disputed';

export type MilestoneStatus =
  | 'Pending'
  | 'Funded'
  | 'Submitted'
  | 'Accepted'
  | 'Released'
  | 'Disputed'
  | 'Revision requested';

export interface Milestone {
  id: string;
  name: string;
  amount: number;
  status: MilestoneStatus;
  dueDate: number;
}

export interface Proposal {
  id: string;
  by: string;
  price: number;
  days: number;
  note: string;
  status: 'Pending' | 'Awarded' | 'Rejected';
  t: number;
}

export interface Project {
  id: string;
  buyerId: string;
  tenantId: string;
  title: string;
  domain: string;
  budget: number;
  stage: ProjectStage;
  description: string;
  milestones: Milestone[];
  ndaRequired: boolean;
  createdAt: number;
  awardedTo: string | null;
  proposals: Proposal[];
  rating: { buyer: number; freelancer: number } | null;
  packaged?: boolean;
}

// ─── Ledger ───────────────────────────────────────────────────────────────────

export type LedgerType =
  | 'Subscription'
  | 'Credits'
  | 'Escrow hold'
  | 'Escrow release'
  | 'Payout'
  | 'Fee'
  | 'Refund';

export interface LedgerEntry {
  id: string;
  t: number;
  tenantId: string;
  type: LedgerType;
  description: string;
  amount: number;
  unit?: string;
  payee?: string;
  fee?: number;
  by: string;
  ref: string;
}

// ─── Notifications ───────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  userId: string;
  t: number;
  text: string;
  link: string;
  read: boolean;
}

// ─── Audit ────────────────────────────────────────────────────────────────────

export interface AuditEntry {
  t: number;
  actor: string;
  role: UserRole;
  action: string;
  entity: string;
  meta: string;
}

// ─── Talent Pools & Outreach ─────────────────────────────────────────────────

export interface TalentPool {
  id: string;
  tenantId: string;
  name: string;
  count: number;
  consentExpiry: number;
  tags: string[];
}

export interface OutreachCampaign {
  id: string;
  tenantId: string;
  name: string;
  channel: 'WhatsApp' | 'Email' | 'SMS';
  sent: number;
  opened: number;
  applied: number;
  status: 'Running' | 'Done' | 'Draft';
  t: number;
}

// ─── API Response wrappers ───────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiError {
  statusCode: number;
  message: string;
  errors?: Record<string, string[]>;
}
