// ─── Talent sourcing & SOW ────────────────────────────────────────────────────
// POST /experts/ai-search and proposal statements of work. Shared by API and web.

import type { Availability, EngagementMode, ExpertCard } from './profile';

/** Talent Passport competency keys the search can ask for (competency_benchmarks). */
export const SEARCHABLE_COMPETENCIES = [
  'algorithms', 'problem_solving', 'technical_depth', 'system_design', 'communication',
  'safety_compliance', 'procedural_knowledge', 'situational_judgement', 'equipment_knowledge',
] as const;
export type SearchableCompetency = (typeof SEARCHABLE_COMPETENCIES)[number];

/** What the AI understood the buyer to want. Every field is optional in effect (empty = no preference). */
export interface ExpertSearchIntent {
  /** One line restating the need, in English. */
  summary: string;
  skills: string[];
  domains: string[];
  competencies: SearchableCompetency[];
  minYears: number | null;
  /** In `currency`, per hour; experts above it are left out. */
  maxHourlyRate: number | null;
  currency: string | null;
  availability: Availability | null;
  engagement: EngagementMode | null;
  location: string | null;
  languages: string[];
}

export interface AiExpertMatch {
  expert: ExpertCard;
  /** 0–100 overall fit. */
  score: number;
  matchedSkills: string[];
  matchedDomains: string[];
  /** Mean Passport score over the requested competencies (or the expert's overall), 0–100; null when unverified. */
  competencyScore: number | null;
  /** Short, human reasons for the ranking ("Passport system design 86"). */
  reasons: string[];
}

export interface AiExpertSearchResponse {
  intent: ExpertSearchIntent;
  results: AiExpertMatch[];
  /** Vetted experts considered before ranking. */
  considered: number;
  credits: { charged: number; balance: number };
}

// ── Statement of work (on a proposal) ──

export interface SowMilestone {
  title: string;
  amount: number;
  /** Days after the contract starts. */
  dueInDays: number;
  acceptanceCriteria: string[];
}

export interface StatementOfWork {
  scope: string;
  deliverables: string[];
  milestones: SowMilestone[];
  assumptions: string[];
  outOfScope: string[];
  revisionRounds: number;
}

// ── Deliverable files ──

export const DELIVERABLE_MAX_BYTES = 50 * 1024 * 1024;

/** Accepted deliverable types (extension → MIME). Anything executable is refused. */
export const DELIVERABLE_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  zip: 'application/zip',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  txt: 'text/plain',
  csv: 'text/csv',
  md: 'text/markdown',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  mp4: 'video/mp4',
  fig: 'application/octet-stream',
};

export interface DeliverableFile {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  milestoneId: string | null;
  orderId: string | null;
  uploadedBy: string;
  createdAt: string;
  /** GET this (signed-in, a party to the work) to download. */
  downloadPath: string;
}

/** POST /deliverables/upload-url */
export interface DeliverableUploadTicket {
  file: DeliverableFile;
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresInSeconds: number;
}
