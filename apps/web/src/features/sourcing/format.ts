/**
 * Pure helpers for the sourcing workspace (sourcing.spec.ts): credit checks, deliverable
 * file checks, the order work log and the escrow milestone tracker.
 */
import {
  DELIVERABLE_MAX_BYTES, DELIVERABLE_TYPES, type Contract, type ContractMilestone, type DeliverableFile, type GigOrder,
} from '@asteai/types';
import type { TagColor } from '@/components/ui';

// ── AI search ──

export const AI_SEARCH_COST_FALLBACK = 15;

export function searchAffordability(balance: number | undefined, cost: number): { ok: boolean; message: string } {
  if (balance === undefined) return { ok: true, message: `${cost} credits per search` };
  if (balance >= cost) return { ok: true, message: `${cost} credits per search · balance ${balance}` };
  return { ok: false, message: `Needs ${cost} credits; you have ${balance}.` };
}

// ── Deliverable files ──

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Same rules as the API: an allowed extension, a matching type, at most 50 MB. */
export function checkDeliverableFile(file: { name: string; type: string; size: number }): { contentType: string } | { error: string } {
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  const mime = DELIVERABLE_TYPES[ext];
  if (!mime || ext === file.name.toLowerCase()) return { error: `.${ext} files aren't accepted. Use PDF, ZIP, images, Office documents, text or MP4.` };
  if (file.size === 0) return { error: 'That file is empty.' };
  if (file.size > DELIVERABLE_MAX_BYTES) return { error: `That file is ${formatBytes(file.size)}; the limit is 50 MB.` };
  // The API signs the canonical type for the extension; the upload sends that header.
  return { contentType: mime };
}

// ── Work log ──

export interface WorkLogEntry { at: string; label: string; detail?: string; kind: 'order' | 'delivery' | 'file' | 'status' }

/** Everything that happened on an order, oldest first: order, deliveries, files, acceptance. */
export function orderWorkLog(order: GigOrder, files: readonly DeliverableFile[] = []): WorkLogEntry[] {
  const log: WorkLogEntry[] = [
    { at: order.createdAt, label: `Ordered ${order.packageName}`, detail: order.requirements, kind: 'order' },
  ];
  for (const d of order.deliveries ?? []) {
    log.push({ at: d.createdAt, label: 'Delivered', detail: [d.note, ...d.links].filter(Boolean).join('\n'), kind: 'delivery' });
  }
  for (const f of files) log.push({ at: f.createdAt, label: `Uploaded ${f.fileName}`, detail: formatBytes(f.sizeBytes), kind: 'file' });
  if (order.revisionsUsed > 0) {
    log.push({ at: order.deliveredAt ?? order.createdAt, label: `${order.revisionsUsed} of ${order.revisions} revision${order.revisions === 1 ? '' : 's'} requested`, kind: 'status' });
  }
  if (order.status === 'completed') log.push({ at: order.deliveredAt ?? order.createdAt, label: 'Accepted, escrow released', kind: 'status' });
  if (order.status === 'cancelled') log.push({ at: order.createdAt, label: 'Cancelled', kind: 'status' });
  return log.sort((a, b) => a.at.localeCompare(b.at));
}

// ── Escrow tracker ──

export interface EscrowSummary {
  total: number;
  funded: number;
  released: number;
  /** Funded and not yet released: what escrow holds now. */
  held: number;
  /** Not funded yet. */
  unfunded: number;
}

export function escrowSummary(c: Pick<Contract, 'totalAmount' | 'escrowFunded' | 'released'>): EscrowSummary {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    total: c.totalAmount,
    funded: c.escrowFunded,
    released: c.released,
    held: r2(Math.max(0, c.escrowFunded - c.released)),
    unfunded: r2(Math.max(0, c.totalAmount - c.escrowFunded)),
  };
}

export const MILESTONE_STAGES = ['Funded', 'Delivered', 'Released'] as const;

/** 0 = not funded, 1 = funded, 2 = deliverable submitted, 3 = released. */
export function milestoneStep(m: Pick<ContractMilestone, 'status'>): number {
  switch (m.status) {
    case 'pending': return 0;
    case 'funded': case 'revision_requested': return 1;
    case 'submitted': case 'accepted': return 2;
    case 'released': return 3;
    default: return 0;
  }
}

export type MilestoneTrigger = 'fund' | 'approve_release' | 'release' | 'submit' | 'dispute' | null;

/** The main action each side has on a milestone right now (the tracker's button). */
export function nextTrigger(m: Pick<ContractMilestone, 'status' | 'paymentPending'>, side: 'buyer' | 'expert', contractActive: boolean): MilestoneTrigger {
  if (!contractActive) return null;
  if (side === 'buyer') {
    if (m.status === 'pending') return m.paymentPending ? null : 'fund';
    if (m.status === 'submitted') return 'approve_release';
    if (m.status === 'accepted') return 'release';
    return null;
  }
  if (m.status === 'funded' || m.status === 'revision_requested') return 'submit';
  return null;
}

export const canDisputeMilestone = (m: Pick<ContractMilestone, 'status'>) =>
  ['funded', 'submitted', 'revision_requested', 'accepted'].includes(m.status);

export function milestoneTag(m: Pick<ContractMilestone, 'status' | 'paymentPending'>): { label: string; color: TagColor } {
  if (m.paymentPending) return { label: 'Payment confirming', color: 'amber' };
  const map: Record<string, { label: string; color: TagColor }> = {
    pending: { label: 'Not funded', color: 'grey' },
    funded: { label: 'Funded · in progress', color: 'gold' },
    submitted: { label: 'Deliverable submitted', color: 'amber' },
    revision_requested: { label: 'Revision requested', color: 'rose' },
    accepted: { label: 'Approved', color: 'mint' },
    released: { label: 'Released', color: 'mint' },
    cancelled: { label: 'Cancelled', color: 'grey' },
  };
  return map[m.status] ?? { label: m.status, color: 'default' };
}
