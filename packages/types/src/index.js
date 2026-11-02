"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEDGER_TYPES = exports.MILESTONE_STATUSES = exports.PROJECT_STAGES = exports.PASSPORT_STATUSES = exports.APPLICATION_STAGES = exports.CANDIDATE_TIERS = exports.REQ_STATUSES = exports.ACCOUNT_STATUSES = exports.USER_ROLES = void 0;
exports.USER_ROLES = ['Employer', 'Candidate', 'Freelancer', 'Buyer', 'Admin'];
exports.ACCOUNT_STATUSES = ['active', 'deactivated', 'deleted'];
exports.REQ_STATUSES = ['Draft', 'Open', 'Paused', 'Closed', 'Filled'];
exports.CANDIDATE_TIERS = ['Technical', 'Non-Technical', 'Frontline', 'Skilled'];
exports.APPLICATION_STAGES = [
    'Applied', 'Eligibility', 'Assessment Pending', 'Assessment Review',
    'Shortlisted', 'Interview', 'Offer', 'Joined', 'Rejected',
];
exports.PASSPORT_STATUSES = ['Valid', 'Expired', 'Revoked'];
exports.PROJECT_STAGES = [
    'Open for Bids', 'Shortlisting', 'Contracted',
    'In Progress', 'Milestone Submitted', 'Completed', 'Disputed',
];
exports.MILESTONE_STATUSES = [
    'Pending', 'Funded', 'Submitted', 'Accepted',
    'Released', 'Disputed', 'Revision requested',
];
exports.LEDGER_TYPES = [
    'Subscription', 'Credits', 'Escrow hold',
    'Escrow release', 'Payout', 'Fee', 'Refund',
];
//# sourceMappingURL=index.js.map