/**
 * What a candidate can be interviewed on. Ported from deeptech_frontend
 * (src/pages/hire/mockInterviewFields.ts and src/lib/frontlineRoles.ts).
 *
 * The AI recognises a frontline role by the exact (skill, domain) pair sent to
 * /mock-interview/start: `skill` is the role label below and `domain` is its field name
 * (deeptech_ai frontline_roles.find_role). Railway fields need "Railways" in the field
 * name, the trades need "Frontline" or "Trades" and never "Railways" (on the railways a
 * Driver is a Loco Pilot). Change a label here only together with deeptech_ai.
 *
 * `roleId` is the deeptech_ai frontline_roles.ROLES key, stored on the interview as
 * frontline_role_id and used later by frontline and enterprise interviews.
 *
 * The shipping roles need deeptech_ai with the shipping packs (AI PR #43); against an
 * AI build without them the interview falls back to a generic one for that title.
 */

export type FieldCategory = 'tech' | 'non-tech' | 'frontline';

export interface FrontlineRoleEntry {
  roleId: string;
  /** What the AI matches on; sent as `skill`. */
  label: string;
}

export interface FrontlineField {
  /** Sent as `domain`. */
  field: string;
  group: string;
  roles: FrontlineRoleEntry[];
}

export const FIELD_CATEGORIES: { id: FieldCategory; label: string }[] = [
  { id: 'tech', label: 'Tech' },
  { id: 'non-tech', label: 'Non-Tech' },
  { id: 'frontline', label: 'Frontline' },
];

export const TECH_DOMAINS = [
  'AI & Machine Learning',
  'Software Engineering',
  'Data Science',
  'Cloud & DevOps',
  'Cybersecurity',
  'Blockchain & Web3',
  'Robotics & IoT',
  'Product Management',
  'Healthcare & Biotech',
  'E-Commerce',
  'EdTech',
  'Other',
];

export const NON_TECH_DOMAINS = [
  'Law & Legal',
  'Finance & Accounting',
  'BFSI (Banking, Financial Services & Insurance)',
  'Human Resources',
  'Sales & Marketing',
  'Education & Teaching',
  'Operations & Administration',
  'Logistics - Air',
  'Logistics - Sea',
  'Logistics - Road',
  'Supply Chain',
  'Other',
];

const r = (roleId: string, label: string): FrontlineRoleEntry => ({ roleId, label });

export const FRONTLINE_FIELDS: FrontlineField[] = [
  {
    field: 'Railways — Track & Station (Frontline)',
    group: 'Indian Railways',
    roles: [
      r('track_maintainer', 'Track Maintainer'),
      r('pointsman', 'Pointsman'),
      r('gateman', 'Gateman'),
      r('station_master', 'Station Master'),
      r('assistant_station_master', 'Assistant Station Master'),
      r('tte', 'Ticket Examiner (TTE)'),
    ],
  },
  {
    field: 'Railways — Hospital & Health Unit (Frontline)',
    group: 'Railway Hospital',
    roles: [
      r('hospital_attendant', 'Hospital Attendant / Ayah'),
      r('dresser', 'Dresser / OT Assistant'),
      r('staff_nurse', 'Staff Nurse'),
      r('railway_pharmacist', 'Pharmacist'),
      r('lab_technician', 'Lab Technician'),
      r('radiographer', 'X-ray Technician'),
      r('ambulance_staff', 'Ambulance Driver / Stretcher Bearer'),
      r('safaiwala', 'Safaiwala (Hospital Cleaner)'),
      r('anti_malaria_worker', 'Anti-Malaria Worker'),
      r('hospital_cook', 'Hospital Cook'),
      r('hospital_watchman', 'Hospital Watchman'),
    ],
  },
  {
    field: 'Trades (Frontline)',
    group: 'Trades',
    roles: [
      r('trade_electrician', 'Electrician'),
      r('trade_plumber', 'Plumber'),
      r('trade_mason', 'Mason'),
      r('trade_driver', 'Driver'),
      r('trade_security', 'Security Guard'),
      r('trade_labour', 'General Labourer'),
    ],
  },
  {
    field: 'Hospitality & Luxury Service (Frontline)',
    group: 'Hospitality & Luxury Service',
    roles: [
      r('luxury_chauffeur', 'Chauffeur / Private Driver (Luxury & VIP)'),
      r('professional_chef', 'Chef (Commis to Executive / Michelin)'),
    ],
  },
  {
    field: 'Care & Retail (Frontline)',
    group: 'Care & Retail',
    roles: [
      r('care_caregiver', 'Home Caregiver / Elder Care'),
      r('care_nanny', 'Nanny / Babysitter'),
      r('retail_associate', 'Retail Store Associate'),
      r('retail_cashier', 'Cashier / Billing'),
    ],
  },
  {
    field: 'Shipping — Deck Officers (Frontline)',
    group: 'Shipping',
    roles: [
      r('ship_master', 'Master / Captain'),
      r('ship_chief_officer', 'Chief Officer / Chief Mate'),
      r('ship_second_officer', 'Second Officer / Second Mate'),
      r('ship_third_officer', 'Third Officer / Deck Cadet'),
    ],
  },
  {
    field: 'Shipping — Engine Officers (Frontline)',
    group: 'Shipping',
    roles: [
      r('ship_chief_engineer', 'Chief Engineer'),
      r('ship_second_engineer', 'Second Engineer'),
      r('ship_third_engineer', 'Third / Fourth Engineer / Engine Cadet'),
      r('ship_eto', 'Electro-Technical Officer (ETO)'),
    ],
  },
  {
    field: 'Shipping — Ratings (Frontline)',
    group: 'Shipping',
    roles: [
      r('ship_bosun', 'Bosun'),
      r('ship_able_seaman', 'Able Seaman (AB) / Ordinary Seaman'),
      r('ship_fitter', 'Fitter'),
      r('ship_motorman', 'Motorman / Oiler / Wiper'),
    ],
  },
  {
    field: 'Shipping — Port & Shore (Frontline)',
    group: 'Shipping',
    roles: [
      r('ship_port_pilot', 'Port / Harbour Pilot'),
      r('ship_crane_operator', 'Crane Operator (STS / RTG)'),
      r('ship_marine_surveyor', 'Marine Surveyor'),
      r('ship_marine_superintendent', 'Marine Superintendent (Technical / Marine)'),
    ],
  },
];

/** Languages the interviewer speaks (deeptech_ai MockInterviewAgent). */
export const INTERVIEW_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'te', label: 'Telugu' },
  { code: 'ta', label: 'Tamil' },
  { code: 'kn', label: 'Kannada' },
  { code: 'bn', label: 'Bengali' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'de', label: 'German' },
  { code: 'ar', label: 'Arabic' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
];

export const LANGUAGE_CODES = INTERVIEW_LANGUAGES.map((l) => l.code);

export function domainsFor(category: FieldCategory): string[] {
  if (category === 'tech') return TECH_DOMAINS;
  if (category === 'non-tech') return NON_TECH_DOMAINS;
  return FRONTLINE_FIELDS.map((f) => f.field);
}

/** The frontline role a (field, label) pair names, or null. */
export function findFrontlineRole(field: string, label: string): FrontlineRoleEntry | null {
  const f = FRONTLINE_FIELDS.find((x) => x.field === field);
  return f?.roles.find((x) => x.label === label) ?? null;
}

export function catalogue() {
  return {
    categories: FIELD_CATEGORIES,
    domains: { tech: TECH_DOMAINS, 'non-tech': NON_TECH_DOMAINS },
    frontline: FRONTLINE_FIELDS,
    languages: INTERVIEW_LANGUAGES,
  };
}
