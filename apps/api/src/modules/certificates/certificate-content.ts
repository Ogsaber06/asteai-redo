/**
 * Certificate content helpers, ported from deeptech_backend services/certificateContent.js
 * and services/certificateScores.js. Pure functions, so they are tested without a DB.
 */

export interface CertificateContent {
  candidate_name?: string;
  certificate_title?: string;
  record_id?: string;
  overall_score?: number | null;
  parameters?: { name: string; score: number }[];
  areas_to_improve?: string[];
  topics_covered?: string[];
  recommendation?: string;
  interview_date?: string;
  [key: string]: unknown;
}

export interface InterviewForCertificate {
  id: string;
  skill?: string | null;
  domain?: string | null;
  candidate_name?: string | null;
}

/**
 * Content built only from what the interview recorded, for when the AI content service
 * cannot be reached. It invents nothing: the title is the skill or field the interview
 * was booked under, and scores come from the proctoring summary via withAssessedScores.
 */
export function certificateContentFromAssessment(interview: InterviewForCertificate): CertificateContent {
  const subject = (interview.skill || '').trim() || (interview.domain || '').trim();
  return {
    candidate_name: interview.candidate_name || 'Candidate',
    certificate_title: subject ? `${subject} Interview Assessment` : 'Interview Assessment',
    record_id: interview.id,
  };
}

const toScore = (value: unknown): number | null => {
  // Number(null) is 0, so an absent score must be rejected before it is coerced.
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const toTextList = (value: unknown): string[] =>
  (Array.isArray(value) ? value : [])
    .filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    .map((item) => item.trim());

/**
 * Copies what the assessment actually produced onto the certificate. The PDF prints only
 * what it is given and omits a score it is not given, so the real numbers must be passed.
 */
export function withAssessedScores(
  certificateContent: CertificateContent,
  proctoringSummary: Record<string, unknown> | null | undefined = {},
): CertificateContent {
  const out: CertificateContent = { ...certificateContent };
  const ps = proctoringSummary || {};

  const overall = toScore(ps.overall_score);
  if (overall !== null) out.overall_score = overall;

  const parameters = [
    { name: 'Technical Knowledge & Depth', score: toScore(ps.technical_score) },
    { name: 'Communication & Clarity', score: toScore(ps.communication_score) },
  ].filter((p): p is { name: string; score: number } => p.score !== null);
  if (parameters.length > 0) out.parameters = parameters;

  const areas = toTextList(ps.areas_to_improve);
  if (areas.length > 0) out.areas_to_improve = areas;
  const topics = toTextList(ps.topics_covered);
  if (topics.length > 0) out.topics_covered = topics;

  // The certificate's own recommendation wins; the summary's only fills a gap.
  const own = typeof out.recommendation === 'string' && out.recommendation.trim();
  if (!own && typeof ps.recommendation === 'string' && ps.recommendation.trim()) {
    out.recommendation = ps.recommendation.trim();
  }
  return out;
}
