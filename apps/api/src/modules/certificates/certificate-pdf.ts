// @ts-nocheck
/**
 * Three-page certificate PDF, ported unchanged in layout from
 * deeptech_backend/services/ProfessionalCertificate.js. Type checking is off for this
 * file only: it is drawing code tuned over many rounds, and retyping it was not worth
 * the risk of moving a single element. Changes from the original:
 *   - CommonJS-friendly imports;
 *   - the logo is read from CERTIFICATE_ASSET_DIR (default: <cwd>/assets);
 *   - the QR code points at the platform's public verify page (PUBLIC_WEB_URL);
 *   - the unused accreditation badge paths were dropped.
 */
// pdfkit is `module.exports = PDFDocument`; this API compiles to CommonJS without
// esModuleInterop, where a default import would resolve to undefined.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');
import * as path from 'path';
import * as fs from 'fs';

const ASSET_DIR = process.env.CERTIFICATE_ASSET_DIR || path.resolve(process.cwd(), 'assets');
const PUBLIC_WEB_URL = (process.env.PUBLIC_WEB_URL || 'http://localhost:3000').replace(/\/$/, '');

/* ────────────────────────────────────────────────────────────────────────
 *  Website-Matched Light Design Tokens
 * ──────────────────────────────────────────────────────────────────────── */
const COLOR = {
  bgPaper: '#FFFFFF',
  navy: '#0F172A',
  slate: '#334155',
  slateMuted: '#64748B',
  slateFaint: '#94A3B8',
  violetPrimary: '#6D28D9',
  violetLight: '#8B5CF6',
  violetSoftBg: '#EEF2FF',
  violetBorder: '#C7D2FE',
  violetText: '#4338CA',
  borderLight: '#E2E8F0',
  cardBg: '#F8FAFC',
  successGreen: '#059669',
  successBg: '#ECFDF5',
  highlightBg: '#F3E8FF',
  highlightBorder: '#D8B4FE',
  highlightText: '#6B21A8',
  highlightBar: '#8B5CF6',
  tealSoftBg: '#F0FDFA',
  tealBorder: '#99F6E4',
  tealText: '#0F766E',
  tealBar: '#14B8A6',
};

const fitSingleLine = (doc, text, font, maxSize, minSize, maxWidth) => {
  let size = maxSize;
  doc.font(font);
  while (size > minSize && doc.fontSize(size).widthOfString(text) > maxWidth) {
    size -= 1;
  }
  return size;
};

const truncateToHeight = (doc, text, width, maxHeight) => {
  if (!text) return '';
  if (doc.heightOfString(text, { width }) <= maxHeight) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = `${text.slice(0, mid).trim()}…`;
    if (doc.heightOfString(candidate, { width }) <= maxHeight) lo = mid;
    else hi = mid - 1;
  }
  return `${text.slice(0, lo).trim()}…`;
};

// Draws modern page frame (Website Light Theme)
const drawPageFrame = (doc, PAGE_W, PAGE_H) => {
  doc.rect(0, 0, PAGE_W, PAGE_H).fill(COLOR.bgPaper);

  const OUT = 20;
  doc.rect(OUT, OUT, PAGE_W - OUT * 2, PAGE_H - OUT * 2).lineWidth(1.2).strokeColor(COLOR.borderLight).stroke();
};

const drawDivider = (doc, PAGE_W, y, half) => {
  doc.moveTo(PAGE_W / 2 - half, y).lineTo(PAGE_W / 2 - 14, y).lineWidth(1).strokeColor(COLOR.violetPrimary).stroke();
  doc.moveTo(PAGE_W / 2 + 14, y).lineTo(PAGE_W / 2 + half, y).lineWidth(1).strokeColor(COLOR.violetPrimary).stroke();
  doc.circle(PAGE_W / 2, y, 3).fillColor(COLOR.violetPrimary).fill();
};

// Helper: Pill Badge
const drawPillBadge = (doc, x, y, text, { bg = COLOR.violetSoftBg, border = COLOR.violetBorder, color = COLOR.violetText, font = 'Helvetica-Bold', fontSize = 8.5 } = {}) => {
  doc.font(font).fontSize(fontSize);
  const textW = doc.widthOfString(text);
  const padX = 10;
  const padY = 4;
  const w = textW + padX * 2;
  const h = fontSize + padY * 2;

  doc.roundedRect(x - w, y, w, h, h / 2).fillColor(bg).fill();
  doc.roundedRect(x - w, y, w, h, h / 2).lineWidth(0.8).strokeColor(border).stroke();
  doc.fillColor(color).text(text, x - w + padX, y + padY, { width: textW, align: 'center' });
  return w;
};

// Helper: Score Row
const drawScoreRow = (doc, x, y, width, name, score, outOf = 100) => {
  const pct = Math.max(0, Math.min(1, Number(score) / Number(outOf || 100)));

  doc.fontSize(9.5).fillColor(COLOR.navy).font('Helvetica-Bold').text(name, x, y, { width: width * 0.7 });
  doc
    .fontSize(9.5)
    .fillColor(COLOR.violetPrimary)
    .font('Helvetica-Bold')
    .text(`${score}%`, x, y, { width, align: 'right' });

  const barY = y + 14;
  const barH = 6;
  doc.roundedRect(x, barY, width, barH, 3).fillColor(COLOR.borderLight).fill();
  if (pct > 0) {
    doc.roundedRect(x, barY, Math.max(width * pct, 8), barH, 3).fillColor(COLOR.violetPrimary).fill();
  }
  return barY + barH + 12;
};

/**
 * Coerces a certificate payload into the shapes the pages assume.
 *
 * Five call sites reach the generator and their content comes from an AI service, so a
 * field can arrive as null, as a string where a list is expected, or as thousands of
 * characters. Each of those used to break the certificate outright:
 *
 *   - a destructuring default does not apply to null, so `parameters: null` reached
 *     `parameters.length` and threw, producing no certificate at all;
 *   - a string where a list was expected threw on `.forEach`;
 *   - very long text pushed a card past the page and pdfkit paginated around it, turning
 *     a three-page certificate into nine.
 *
 * Absent values become undefined so the destructuring defaults below take over. Lengths are
 * clamped rather than rejected: an over-long strength is still printed, just trimmed.
 */
// Characters the standard-14 fonts can draw: PDFKit encodes them as WinAnsi, which is
// Latin-1 plus these extras. Anything else prints as unrelated Latin-1 glyphs — a
// Bengali name came out as "š©Í› œœÙž›â".
const WIN_ANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
const isRenderable = (ch) => ch.codePointAt(0) <= 0xff || WIN_ANSI_EXTRA.includes(ch);
const NON_LATIN_LETTER = /(?!\p{Script=Latin})\p{L}/u;
// Latin letters with no Unicode decomposition to a base letter.
const LATIN_FALLBACK = { Ł: 'L', ł: 'l', Đ: 'D', đ: 'd', Ħ: 'H', ħ: 'h', ı: 'i', Ŧ: 'T', ŧ: 't' };

/**
 * Text the certificate fonts can print, or undefined. A field written in another
 * script (Bengali, Devanagari, Arabic, CJK…) is dropped whole so its default applies;
 * stripping it letter by letter would leave fragments like "AI Interview Assessment - ".
 * Latin letters outside WinAnsi lose their accent ("ő" becomes "o", "Ł" becomes "L"),
 * and emoji are removed.
 */
export function toRenderableText(str) {
  if (NON_LATIN_LETTER.test(str)) return undefined;
  let out = '';
  for (const ch of str) {
    if (isRenderable(ch)) {
      out += ch;
    } else if (LATIN_FALLBACK[ch]) {
      out += LATIN_FALLBACK[ch];
    } else {
      const base = ch.normalize('NFKD').replace(/\p{M}/gu, '');
      if (base && [...base].every(isRenderable)) out += base;
    }
  }
  const cleaned = out.replace(/[ \t]{2,}/g, ' ').trim();
  return cleaned || undefined;
}

function normalizeCertificateSummary(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};

  const text = (value, max) => {
    if (value === null || value === undefined) return undefined;
    const str = typeof value === 'string' ? value : String(value);
    const trimmed = toRenderableText(str.trim());
    if (!trimmed) return undefined;
    return trimmed.length > max ? `${trimmed.slice(0, max - 1).trimEnd()}…` : trimmed;
  };

  const textList = (value, maxItems, maxLen) => {
    // A lone string is treated as a one-item list rather than discarded.
    const list = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
    const cleaned = list
      .filter((item) => typeof item === 'string' && item.trim())
      .map((item) => text(item, maxLen))
      .filter(Boolean);
    return cleaned.slice(0, maxItems);
  };

  const score = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null;
  };

  // Keeps every other field on the item — page 3 reads `desc`/`description` off a trait —
  // and only normalizes the label it is keyed by and its score.
  const scored = (value, key, maxItems, descKeys = []) => (Array.isArray(value) ? value : [])
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const out = { ...item, [key]: text(item[key], 60), score: score(item.score) };
      for (const dk of descKeys) {
        if (item[dk] !== undefined) out[dk] = text(item[dk], 220);
      }
      return out;
    })
    .filter((item) => item[key] && item.score !== null)
    .slice(0, maxItems);

  return {
    ...source,
    candidate_name: text(source.candidate_name, 80),
    certificate_title: text(source.certificate_title, 120),
    overall_score: score(source.overall_score),
    interview_date: text(source.interview_date, 40),
    record_id: text(source.record_id, 80),
    overall_assessment: text(source.overall_assessment, 700),
    recommendation: text(source.recommendation, 400),
    parameters: scored(source.parameters, 'name', 8),
    // Traits are keyed by title, with the prose in desc or description.
    behavioral_traits: scored(source.behavioral_traits, 'title', 8, ['desc', 'description']),
    domains_demonstrated: textList(source.domains_demonstrated, 8, 60),
    key_strengths: textList(source.key_strengths, 3, 300),
    recommended_roles: textList(source.recommended_roles, 6, 60),
    areas_to_improve: textList(source.areas_to_improve, 3, 260),
    topics_covered: textList(source.topics_covered, 8, 60),
  };
}

export async function generateProfessionalCertificate(rawSummary): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const chunks = [];

      // Standard Landscape A4 (841.89 x 595.28 points)
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
      const PAGE_W = doc.page.width;
      const PAGE_H = doc.page.height;
      const CENTER_W = 700;

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // These defaults are deliberately neutral. They used to name a specific person and
      // award a specific senior title, so any caller that passed a row without a name or
      // title printed a certificate for "Saket Verma, Senior AI & Cloud Solutions
      // Specialist" — five call sites reach this function and only two set a name.
      const summary = normalizeCertificateSummary(rawSummary);

      const {
        candidate_name = 'Candidate',
        certificate_title = '',
        overall_score = null,
        interview_date = new Date().toLocaleDateString('en-US', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
        record_id = '',
        parameters = [],
        behavioral_traits = [],
        domains_demonstrated = [],
        key_strengths = [],
        recommended_roles = [],
        overall_assessment = '',
        recommendation = '',
        areas_to_improve = [],
        topics_covered = [],
      } = summary;

      const certificateId = record_id
        ? record_id
        : `CERT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const verificationUrl = `${PUBLIC_WEB_URL}/verify/certificate/${encodeURIComponent(certificateId)}`;

      const logoPath = path.join(ASSET_DIR, 'logo.png');

      /* ══════════════════════════════════════════════════════════════
       *  PAGE 1 — Certificate of Achievement
       * ══════════════════════════════════════════════════════════════ */
      drawPageFrame(doc, PAGE_W, PAGE_H);

      // Header: Crystalline Triangle Emblem ONLY enlarged (height = 40px), ASTEAI text stays small (16px)
      let textStartX = 50;
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 28, { height: 40 });
        textStartX = 102;
      }

      doc
        .fontSize(20)
        .fillColor(COLOR.navy)
        .font('Times-Bold')
        .text('ASTEAI', textStartX, 38);

      drawPillBadge(doc, PAGE_W - 50, 40, 'VERIFIED OFFICIAL ASSESSMENT');

      // Main Content Center
      doc
        .fontSize(10)
        .fillColor(COLOR.slateMuted)
        .font('Helvetica-Bold')
        .text('THIS OFFICIAL CERTIFICATE IS AWARDED TO', 0, 150, { align: 'center', characterSpacing: 1.5 });

      const nameSize = fitSingleLine(doc, candidate_name, 'Helvetica-Bold', 36, 22, CENTER_W);
      doc.fontSize(nameSize).fillColor(COLOR.navy).font('Helvetica-Bold').text(candidate_name, 0, 178, { align: 'center' });

      doc
        .fontSize(12)
        .fillColor(COLOR.slateMuted)
        .font('Helvetica')
        .text('who has successfully demonstrated verified proficiency and completed the assessment for', 0, 236, { align: 'center' });

      const rawTitle = certificate_title || 'AI Interview Assessment';
      const formattedTitle = rawTitle
        .replace(/Mock Interview Assessment/gi, 'AI Interview Assessment')
        .replace(/Mock Interview/gi, 'AI Interview Assessment')
        .replace(/\bMock\b/gi, 'AI Interview Assessment');

      const titleSize = fitSingleLine(doc, formattedTitle, 'Helvetica-Bold', 22, 14, CENTER_W);
      doc.fontSize(titleSize).fillColor(COLOR.violetPrimary).font('Helvetica-Bold').text(formattedTitle, 0, 264, { align: 'center' });

      drawDivider(doc, PAGE_W, 312, 140);

      doc
        .fontSize(10.5)
        .fillColor(COLOR.slateMuted)
        .font('Helvetica-Oblique')
        .text(
          'Issued by AsteAI\'s AI-Powered Talent & Skill Assessment Engine in recognition of technical excellence, problem-solving speed, and verified domain mastery.',
          PAGE_W / 2 - 270,
          336,
          { width: 540, align: 'center', lineGap: 4 }
        );

      // Bottom Section: Issue Details (Right)
      const isoSectionY = 440;

      // Right metadata
      const rightMetaX = PAGE_W - 250;
      doc
        .fontSize(8.5)
        .fillColor(COLOR.slateMuted)
        .font('Helvetica-Bold')
        .text('DATE OF ISSUE', rightMetaX, isoSectionY + 4, { width: 200, align: 'right' });
      doc
        .fontSize(11)
        .fillColor(COLOR.navy)
        .font('Helvetica-Bold')
        .text(interview_date, rightMetaX, isoSectionY + 16, { width: 200, align: 'right' });

      doc
        .fontSize(8.5)
        .fillColor(COLOR.slateMuted)
        .font('Helvetica-Bold')
        .text('VERIFICATION ID', rightMetaX, isoSectionY + 38, { width: 200, align: 'right' });
      doc
        .fontSize(10.5)
        .fillColor(COLOR.navy)
        .font('Helvetica-Bold')
        .text(certificateId, rightMetaX, isoSectionY + 50, { width: 200, align: 'right' });

      // Bottom Frame Footer Page 1
      doc
        .fontSize(8)
        .fillColor(COLOR.slateFaint)
        .font('Helvetica')
        .text(`Verified online at: ${verificationUrl}`, 50, PAGE_H - 30);
      doc
        .fontSize(8.2)
        .fillColor(COLOR.slateFaint)
        .font('Helvetica')
        .text('Issued under an ISO/IEC 27001:2022 certified ISMS', PAGE_W - 420, PAGE_H - 30, { width: 370, align: 'right' });


      /* ══════════════════════════════════════════════════════════════
       *  PAGE 2 — Detailed Assessment Report
       * ══════════════════════════════════════════════════════════════ */
      doc.addPage({ size: 'A4', layout: 'landscape', margin: 0 });
      drawPageFrame(doc, PAGE_W, PAGE_H);

      // Header: Crystalline Triangle Emblem ONLY enlarged (height = 40px), text stays small (15px)
      let textStartX2 = 50;
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 28, { height: 40 });
        textStartX2 = 102;
      }

      doc
        .fontSize(15)
        .fillColor(COLOR.navy)
        .font('Times-Bold')
        .text('DETAILED ASSESSMENT REPORT', textStartX2, 41);

      // Only real, assessed parameters are printed. These were previously invented from the
      // certificate title with a 70% floor and a 94% default, so a candidate who scored 19%
      // received a certificate reading 94%.
      // null/'' must not become 0 here — Number(null) is 0, which would print "OVERALL SCORE: 0%"
      const toScore = (value) => {
        if (value === null || value === undefined || value === '') return null;
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
      };

      const shownParams = (Array.isArray(parameters) ? parameters : [])
        .filter((p) => p && p.name && toScore(p.score) !== null)
        .slice(0, 5)
        .map((p) => ({ ...p, score: toScore(p.score) }));

      const paramAverage = shownParams.length > 0
        ? Math.round(shownParams.reduce((acc, p) => acc + p.score, 0) / shownParams.length)
        : null;
      const overallScoreVal = toScore(overall_score) !== null ? toScore(overall_score) : paramAverage;

      if (overallScoreVal !== null) {
        drawPillBadge(doc, PAGE_W - 50, 40, `OVERALL SCORE: ${overallScoreVal}%`);
      }

      const subtitle = `${candidate_name} — ${formattedTitle}`;
      const subtitleSize = fitSingleLine(doc, subtitle, 'Helvetica-Bold', 12, 10, CENTER_W);
      doc
        .fontSize(subtitleSize)
        .fillColor(COLOR.slateMuted)
        .font('Helvetica-Bold')
        .text(subtitle, 50, 85);

      drawDivider(doc, PAGE_W, 102, 370);

      const contentLeft = 50;
      const contentRight = PAGE_W - 50;
      const contentWidth = contentRight - contentLeft;

      let cursorY = 115;
      const colGap = 20;
      const colWidth = (contentWidth - colGap) / 2;
      const cardHeight = 210;

      // ── Card 1: Parameter Performance Breakdown (Left Column) ─────────────
      doc
        .roundedRect(contentLeft, cursorY, colWidth, cardHeight, 10)
        .fillColor(COLOR.cardBg)
        .fill();
      doc
        .roundedRect(contentLeft, cursorY, colWidth, cardHeight, 10)
        .lineWidth(0.8)
        .strokeColor(COLOR.borderLight)
        .stroke();

      let card1Y = cursorY + 14;
      const cardInnerX1 = contentLeft + 16;
      const cardInnerW1 = colWidth - 32;

      doc
        .fontSize(9)
        .fillColor(COLOR.slateMuted)
        .font('Helvetica-Bold')
        .text('PARAMETER PERFORMANCE BREAKDOWN', cardInnerX1, card1Y, { characterSpacing: 0.5 });
      card1Y += 18;

      if (shownParams.length > 0) {
        shownParams.forEach((p) => {
          card1Y = drawScoreRow(doc, cardInnerX1, card1Y, cardInnerW1, p.name, p.score, p.outOf || 100);
        });
      } else {
        doc
          .fontSize(9)
          .fillColor(COLOR.slate)
          .font('Helvetica')
          .text('Per-parameter scores were not recorded for this assessment.', cardInnerX1, card1Y, { width: cardInnerW1, lineGap: 2.5 });
      }

      // ── Card 2: Demonstrated Skills & Verified Key Strengths (Right Column) ─
      const rightX = contentLeft + colWidth + colGap;

      doc
        .roundedRect(rightX, cursorY, colWidth, cardHeight, 10)
        .fillColor(COLOR.cardBg)
        .fill();
      doc
        .roundedRect(rightX, cursorY, colWidth, cardHeight, 10)
        .lineWidth(0.8)
        .strokeColor(COLOR.borderLight)
        .stroke();

      let card2Y = cursorY + 14;
      const cardInnerX2 = rightX + 16;
      const cardInnerW2 = colWidth - 32;

      doc
        .fontSize(9)
        .fillColor(COLOR.slateMuted)
        .font('Helvetica-Bold')
        .text('DEMONSTRATED CORE SKILLS', cardInnerX2, card2Y, { characterSpacing: 0.5 });
      card2Y += 16;

      // Only skills the assessment recorded. This used to fall back to a fixed
      // "Python 3.11 / PyTorch / AWS / Docker / FastAPI" set, so every assessment that
      // recorded none — a Law interview included — certified the candidate in Python and ML.
      const skillsToDraw = domains_demonstrated.slice(0, 6);

      let px = cardInnerX2;
      let py = card2Y;

      if (skillsToDraw.length === 0) {
        doc
          .fontSize(8.2)
          .fillColor(COLOR.slate)
          .font('Helvetica')
          .text('No specific skills were evidenced in this session.', cardInnerX2, card2Y, { width: cardInnerW2 });
        py = card2Y - 6;
      }

      skillsToDraw.forEach((skillText) => {
        doc.font('Helvetica-Bold').fontSize(8);
        const tw = doc.widthOfString(skillText);
        const pw = tw + 14;
        const ph = 18;

        if (px + pw > cardInnerX2 + cardInnerW2) {
          px = cardInnerX2;
          py += ph + 5;
        }

        doc.roundedRect(px, py, pw, ph, 5).fillColor(COLOR.violetSoftBg).fill();
        doc.roundedRect(px, py, pw, ph, 5).lineWidth(0.6).strokeColor(COLOR.violetBorder).stroke();
        doc.fillColor(COLOR.violetText).text(skillText, px + 7, py + 4, { width: tw, align: 'center' });

        px += pw + 6;
      });

      card2Y = py + 24;

      doc
        .fontSize(9)
        .fillColor(COLOR.slateMuted)
        .font('Helvetica-Bold')
        .text('VERIFIED KEY STRENGTHS', cardInnerX2, card2Y, { characterSpacing: 0.5 });
      card2Y += 14;

      // Same rule as the skills above: the old fallback printed three cloud/LLM strengths
      // no assessment had found.
      const strengthsToDraw = key_strengths.length > 0
        ? key_strengths.slice(0, 3)
        : ['No verified strengths were recorded for this session.'];

      // Bounded so the bullets cannot run past the card and force pdfkit to add a page.
      const card2BottomLimit = card2Y + 74;
      strengthsToDraw.forEach((st) => {
        const remaining = card2BottomLimit - card2Y;
        if (remaining < 10) return;
        const bulletText = truncateToHeight(doc.fontSize(8.2), `•  ${st}`, cardInnerW2, remaining);
        if (!bulletText) return;
        doc.fontSize(8.2).fillColor(COLOR.slate).font('Helvetica').text(bulletText, cardInnerX2, card2Y, { width: cardInnerW2, lineGap: 1.5 });
        card2Y += doc.heightOfString(bulletText, { width: cardInnerW2 }) + 3;
      });

      // ── Card 3: Overall AI Evaluation Summary (Full Width Bottom Card) ────────
      const card3Y = cursorY + cardHeight + 10;
      const card3Height = 85;

      doc
        .roundedRect(contentLeft, card3Y, contentWidth, card3Height, 10)
        .fillColor(COLOR.cardBg)
        .fill();
      doc
        .roundedRect(contentLeft, card3Y, contentWidth, card3Height, 10)
        .lineWidth(0.8)
        .strokeColor(COLOR.borderLight)
        .stroke();

      let card3InnerY = card3Y + 12;
      const card3InnerX = contentLeft + 16;
      const card3InnerW = contentWidth - 36;

      doc
        .fontSize(9)
        .fillColor(COLOR.slateMuted)
        .font('Helvetica-Bold')
        .text('OVERALL AI EVALUATION SUMMARY', card3InnerX, card3InnerY, { characterSpacing: 0.5 });
      card3InnerY += 14;

      const defaultSummaryText = overallScoreVal !== null
        ? `${candidate_name} completed the ${formattedTitle} assessment with an overall score of ${overallScoreVal}%. A detailed assessment summary was not generated for this session.`
        : `${candidate_name} completed the ${formattedTitle} assessment. A detailed assessment summary was not generated for this session.`;

      const summaryContent = overall_assessment || defaultSummaryText;
      const fittedSummary = truncateToHeight(doc, summaryContent, card3InnerW, 52);

      doc.fontSize(9).fillColor(COLOR.navy).font('Helvetica').text(fittedSummary, card3InnerX, card3InnerY, { width: card3InnerW, lineGap: 2.5 });

      // ── Card 4: Recommended for Roles (Highlighted Soft Violet Callout Box) ──
      // Printed only when the assessment actually produced roles. These were previously
      // inferred from the certificate title, which put generic IT roles on non-IT certificates.
      const rolesList = Array.isArray(recommended_roles)
        ? recommended_roles.filter((role) => typeof role === 'string' && role.trim())
        : [];

      if (rolesList.length > 0) {
        const card4Y = card3Y + card3Height + 10;
        const card4Height = 44;

        doc
          .roundedRect(contentLeft, card4Y, contentWidth, card4Height, 8)
          .fillColor(COLOR.highlightBg)
          .fill();
        doc
          .roundedRect(contentLeft, card4Y, contentWidth, card4Height, 8)
          .lineWidth(1)
          .strokeColor(COLOR.highlightBorder)
          .stroke();
        doc
          .roundedRect(contentLeft, card4Y, 6, card4Height, 3)
          .fillColor(COLOR.highlightBar)
          .fill();

        const card4InnerX = contentLeft + 16;

        doc
          .fontSize(9.5)
          .fillColor(COLOR.highlightText)
          .font('Helvetica-Bold')
          .text('RECOMMENDED FOR ROLES:', card4InnerX, card4Y + 16, { characterSpacing: 0.6 });

        let rolePx = card4InnerX + doc.font('Helvetica-Bold').fontSize(9.5).widthOfString('RECOMMENDED FOR ROLES:') + 14;
        let rolePy = card4Y + 11;

        rolesList.slice(0, 3).forEach((role) => {
          doc.font('Helvetica-Bold').fontSize(8.5);
          // +22 (not +18) so the label always fits on one line inside its pill
          const rW = doc.widthOfString(role) + 22;
          const rH = 22;

          if (rolePx + rW > contentRight - 10) {
            rolePx = card4InnerX;
            rolePy += rH + 4;
          }

          doc.roundedRect(rolePx, rolePy, rW, rH, 11).fillColor('#FFFFFF').fill();
          doc.roundedRect(rolePx, rolePy, rW, rH, 11).lineWidth(0.8).strokeColor(COLOR.violetBorder).stroke();
          doc.fillColor(COLOR.violetPrimary).text(role, rolePx + 9, rolePy + 6, { width: rW - 18, align: 'center' });

          rolePx += rW + 8;
        });
      }

      // Footer line Page 2
      doc
        .fontSize(8)
        .fillColor(COLOR.slateFaint)
        .font('Helvetica')
        .text(`Verified online at: ${verificationUrl}`, 50, PAGE_H - 30);
      doc
        .fontSize(8.2)
        .fillColor(COLOR.slateFaint)
        .font('Helvetica')
        .text('Issued under an ISO/IEC 27001:2022 certified ISMS', PAGE_W - 420, PAGE_H - 30, { width: 370, align: 'right' });

      // Page 3 is always printed, but it only ever shows what the assessment recorded.
      // Its behavioural scores and write-ups used to be derived from the overall score
      // (+2 / -2 / +1, floored at 70%) and printed as measured traits. So when real traits
      // exist it reports them; when none were measured it becomes a development report
      // built from the assessment's own areas to improve, topics and recommendation, and
      // says plainly that behaviour was not assessed.
      const shownTraits = (Array.isArray(behavioral_traits) ? behavioral_traits : [])
        .filter((t) => t && t.title && t.score !== undefined && t.score !== null && t.score !== '')
        .slice(0, 4)
        .map((t) => ({
          title: t.title,
          score: toScore(t.score) !== null ? `${Math.round(toScore(t.score))}%` : String(t.score),
          desc: t.desc || t.description || '',
        }));
      const hasTraits = shownTraits.length > 0;

      const toTextList = (value) => (Array.isArray(value) ? value : [])
        .filter((item) => typeof item === 'string' && item.trim())
        .map((item) => item.trim());
      const clip = (value, max) => (value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value);
      const improvementAreas = toTextList(areas_to_improve).slice(0, 3).map((a) => clip(a, 260));
      const topicsList = toTextList(topics_covered).slice(0, 8).map((t) => clip(t, 60));
      const recommendationText = typeof recommendation === 'string' ? recommendation.trim() : '';

      /* ══════════════════════════════════════════════════════════════
       *  PAGE 3 — Hiring & Behavioral Resilience Report, or
       *           Candidate Development Report when behaviour was not assessed
       * ══════════════════════════════════════════════════════════════ */
      doc.addPage({ size: 'A4', layout: 'landscape', margin: 0 });
      drawPageFrame(doc, PAGE_W, PAGE_H);

      let textStartX3 = 50;
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 28, { height: 40 });
        textStartX3 = 102;
      }

      doc
        .fontSize(15)
        .fillColor(COLOR.navy)
        .font('Times-Bold')
        .text(hasTraits ? 'HIRING & BEHAVIORAL RESILIENCE REPORT' : 'CANDIDATE DEVELOPMENT REPORT', textStartX3, 41);

      drawPillBadge(doc, PAGE_W - 50, 40, 'CANDIDATE INSIGHTS PAGE 3');

      const p3Subtitle = hasTraits
        ? `${candidate_name} — Holistic Behavioral & Trait Analytics`
        : `${candidate_name} — Development Focus & Assessment Coverage`;
      const p3SubtitleSize = fitSingleLine(doc, p3Subtitle, 'Helvetica-Bold', 12, 10, CENTER_W);
      doc
        .fontSize(p3SubtitleSize)
        .fillColor(COLOR.slateMuted)
        .font('Helvetica-Bold')
        .text(p3Subtitle, 50, 85);

      drawDivider(doc, PAGE_W, 102, 370);

      // Main Framework Callout Banner
      let c3Y = 120;
      doc.roundedRect(contentLeft, c3Y, contentWidth, 90, 10).fillColor(COLOR.tealSoftBg).fill();
      doc.roundedRect(contentLeft, c3Y, contentWidth, 90, 10).lineWidth(1).strokeColor(COLOR.tealBorder).stroke();
      doc.roundedRect(contentLeft, c3Y, 8, 90, 4).fillColor(COLOR.tealBar).fill();

      doc
        .fontSize(11)
        .fillColor(COLOR.tealText)
        .font('Helvetica-Bold')
        .text(hasTraits ? 'CORE HIRING PHILOSOPHY & ATTRIBUTE FRAMEWORK' : 'ABOUT THIS PAGE', contentLeft + 20, c3Y + 16);
      doc.fontSize(10).fillColor(COLOR.navy).font('Helvetica').text(
        hasTraits
          ? 'This page reports the behavioural attributes observed during the interview. Each score is supported by a specific moment in the transcript; attributes the interview did not evidence are not listed.'
          : 'Behavioural attributes were not assessed in this session, so this page shows no behavioural scores. The sections below are only what the assessment itself recorded; anything it did not record is left out rather than filled in.',
        contentLeft + 20,
        c3Y + 36,
        { width: contentWidth - 40, lineGap: 3.5 }
      );

      c3Y += 108;
      const gridW = (contentWidth - 18) / 2;

      if (hasTraits) {
        // Behavioral Attribute Grid (4 Cards)
        const gridH = 110;

        shownTraits.forEach((t, i) => {
          const gx = contentLeft + (i % 2) * (gridW + 18);
          const gy = c3Y + Math.floor(i / 2) * (gridH + 16);

          doc.roundedRect(gx, gy, gridW, gridH, 8).fillColor(COLOR.cardBg).fill();
          doc.roundedRect(gx, gy, gridW, gridH, 8).lineWidth(0.8).strokeColor(COLOR.borderLight).stroke();

          doc.fontSize(9.5).fillColor(COLOR.violetPrimary).font('Helvetica-Bold').text(t.title, gx + 14, gy + 14);
          doc.fontSize(9.5).fillColor(COLOR.navy).font('Helvetica-Bold').text(t.score, gx + gridW - 85, gy + 14, { width: 70, align: 'right' });
          doc.fontSize(8.5).fillColor(COLOR.slate).font('Helvetica').text(t.desc, gx + 14, gy + 36, { width: gridW - 28, lineGap: 2.5 });
        });
      } else {
        // Development report: one card per section the assessment actually recorded.
        const sections = [];
        if (improvementAreas.length > 0) {
          sections.push({ title: 'AREAS TO IMPROVE', lines: improvementAreas.map((a) => `•  ${a}`) });
        }
        if (topicsList.length > 0) {
          sections.push({ title: 'TOPICS COVERED', lines: [topicsList.join('   •   ')] });
        }
        if (recommendationText) {
          sections.push({ title: 'ASSESSMENT RECOMMENDATION', lines: [recommendationText] });
        }
        if (sections.length === 0) {
          sections.push({ title: 'ASSESSMENT DETAIL', lines: ['No further assessment detail was recorded for this session.'] });
        }

        const cardsBottom = PAGE_H - 48;
        const fullH = cardsBottom - c3Y;
        const drawSection = (section, x, y, w, h) => {
          doc.roundedRect(x, y, w, h, 8).fillColor(COLOR.cardBg).fill();
          doc.roundedRect(x, y, w, h, 8).lineWidth(0.8).strokeColor(COLOR.borderLight).stroke();
          doc.fontSize(9.5).fillColor(COLOR.violetPrimary).font('Helvetica-Bold').text(section.title, x + 14, y + 14, { characterSpacing: 0.5 });

          let lineY = y + 36;
          doc.fontSize(9).fillColor(COLOR.slate).font('Helvetica');
          for (const line of section.lines) {
            const lineH = doc.heightOfString(line, { width: w - 28, lineGap: 2.5 });
            if (lineY + lineH > y + h - 12) break; // never spill out of the card
            doc.text(line, x + 14, lineY, { width: w - 28, lineGap: 2.5 });
            lineY += lineH + 8;
          }
        };

        if (sections.length === 1) {
          drawSection(sections[0], contentLeft, c3Y, contentWidth, Math.min(fullH, 150));
        } else if (sections.length === 2) {
          drawSection(sections[0], contentLeft, c3Y, gridW, fullH);
          drawSection(sections[1], contentLeft + gridW + 18, c3Y, gridW, fullH);
        } else {
          const halfH = (fullH - 16) / 2;
          drawSection(sections[0], contentLeft, c3Y, gridW, fullH);
          drawSection(sections[1], contentLeft + gridW + 18, c3Y, gridW, halfH);
          drawSection(sections[2], contentLeft + gridW + 18, c3Y + halfH + 16, gridW, halfH);
        }
      }

      // Footer line Page 3
      doc
        .fontSize(8)
        .fillColor(COLOR.slateFaint)
        .font('Helvetica')
        .text(`Verified online at: ${verificationUrl}`, 50, PAGE_H - 30);
      doc
        .fontSize(8.2)
        .fillColor(COLOR.slateFaint)
        .font('Helvetica')
        .text('Issued under an ISO/IEC 27001:2022 certified ISMS', PAGE_W - 420, PAGE_H - 30, { width: 370, align: 'right' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}