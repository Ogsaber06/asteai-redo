'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { DISPUTE_REASON_CODES, type Contract, type ContractMilestone, type Invoice } from '@asteai/types';
import { errorMessage, fetcher } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Button, Dialog, Empty, Panel, Tag } from '@/components/ui';
import { contractsApi, formatMoney } from '@/features/contracts';
import { downloadInvoicePdf, INVOICES_KEY } from '@/features/billing';
import { payWithRazorpay, PAYMENT_MESSAGES } from '@/features/payments';
import { escrowSummary, MILESTONE_STAGES, milestoneStep, milestoneTag, nextTrigger, canDisputeMilestone } from './format';
import styles from './Sourcing.module.css';

type Msg = { ok: boolean; text: string } | null;

/**
 * Milestone escrow tracker: how much is funded, held and released, each milestone's stage
 * (funded → delivered → released), the action that's due, and its invoices.
 */
export function EscrowTracker({ contract, onChanged }: { contract: Contract; onChanged: () => void }) {
  const user = useAuthStore((s) => s.user);
  const side = user?.id === contract.buyerId ? 'buyer' : user?.id === contract.expertId ? 'expert' : null;
  const sum = escrowSummary(contract);
  const pct = (n: number) => `${sum.total ? (n / sum.total) * 100 : 0}%`;
  const active = contract.status === 'active';
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [submitting, setSubmitting] = useState<ContractMilestone | null>(null);
  const [disputing, setDisputing] = useState<ContractMilestone | null>(null);
  const [revising, setRevising] = useState<ContractMilestone | null>(null);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState<string>('quality');

  const { data: invoices } = useSWR<Invoice[]>(INVOICES_KEY, fetcher);
  const mine = (invoices ?? []).filter((i) => i.contractId === contract.id);

  async function act(m: ContractMilestone, fn: () => Promise<unknown>, ok: string) {
    setBusy(m.id);
    setMsg(null);
    try { await fn(); setMsg({ ok: true, text: ok }); onChanged(); } catch (err) {
      setMsg({ ok: false, text: errorMessage(err, 'That did not work') });
    } finally { setBusy(null); }
  }

  async function fund(m: ContractMilestone) {
    setBusy(m.id);
    setMsg(null);
    try {
      const checkout = await contractsApi.fund(contract.id, m.id);
      const out = await payWithRazorpay(checkout, {
        name: 'AsteAI escrow', description: `${contract.id} · milestone ${m.seq}: ${m.title}`,
        prefill: { name: [user?.firstName, user?.lastName].filter(Boolean).join(' '), email: user?.email },
      });
      setMsg({
        ok: out.kind === 'captured' || out.kind === 'pending',
        text: out.kind === 'failed' ? PAYMENT_MESSAGES.failed(out.message) : PAYMENT_MESSAGES[out.kind],
      });
      onChanged();
    } catch (err) {
      setMsg({ ok: false, text: errorMessage(err, 'Could not start the payment') });
    } finally { setBusy(null); }
  }

  return (
    <>
      <Panel className={styles.stack}>
        <div className={styles.between}>
          <h2 className={styles.h2}>Escrow</h2>
          <span className={styles.muted}>{formatMoney(sum.total, contract.currency)} total</span>
        </div>
        <div className={styles.escrowBar} role="img"
          aria-label={`${formatMoney(sum.released, contract.currency)} released, ${formatMoney(sum.held, contract.currency)} held in escrow, ${formatMoney(sum.unfunded, contract.currency)} not funded`}>
          <span className={styles.barReleased} style={{ width: pct(sum.released) }} />
          <span className={styles.barHeld} style={{ width: pct(sum.held) }} />
        </div>
        <div className={styles.legend}>
          <span><i className={`${styles.swatch} ${styles.barReleased}`} />Released {formatMoney(sum.released, contract.currency)}</span>
          <span><i className={`${styles.swatch} ${styles.barHeld}`} />Held in escrow {formatMoney(sum.held, contract.currency)}</span>
          <span><i className={styles.swatch} style={{ background: 'var(--bg-3)' }} />Not funded {formatMoney(sum.unfunded, contract.currency)}</span>
        </div>
        {!active && <p className={styles.muted}>Contract is {contract.status}: milestone actions are paused.</p>}
        {msg && <p className={msg.ok ? styles.ok : styles.error} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}

        <ol className={styles.milestones}>
          {contract.milestones.map((m) => {
            const tag = milestoneTag(m);
            const step = milestoneStep(m);
            const trigger = side ? nextTrigger(m, side, active) : null;
            return (
              <li key={m.id} className={styles.milestone}>
                <div className={styles.between}>
                  <span><strong>{m.seq}. {m.title}</strong> <span className={styles.muted}>· {formatMoney(m.amount, contract.currency)}{m.dueDate ? ` · due ${m.dueDate}` : ''}</span></span>
                  <Tag color={tag.color}>{tag.label}</Tag>
                </div>
                <div className={styles.steps} aria-hidden="true">
                  {MILESTONE_STAGES.map((s, i) => <span key={s} className={i < step ? `${styles.step} ${styles.stepDone}` : styles.step} />)}
                </div>
                <div className={styles.stepLabels} aria-label={`Step ${step} of 3`}>{MILESTONE_STAGES.map((s) => <span key={s}>{s}</span>)}</div>
                {m.submissionNote && m.status !== 'released' && <p className={styles.logDetail}>Deliverable note: {m.submissionNote}</p>}
                {m.revisionNote && m.status === 'revision_requested' && <p className={styles.logDetail}>Revision asked: {m.revisionNote}</p>}
                <div className={styles.row}>
                  {trigger === 'fund' && <Button variant="primary" disabled={busy === m.id} onClick={() => { void fund(m); }}>Fund {formatMoney(m.amount, contract.currency)}</Button>}
                  {trigger === 'submit' && <Button variant="primary" disabled={busy === m.id} onClick={() => { setSubmitting(m); setNote(''); }}>Submit deliverable</Button>}
                  {trigger === 'approve_release' && (
                    <>
                      <Button variant="mint" disabled={busy === m.id} onClick={() => { void act(m, () => contractsApi.approveRelease(contract.id, m.id), `Approved; ${formatMoney(m.amount, contract.currency)} released to the expert.`); }}>
                        Approve & release {formatMoney(m.amount, contract.currency)}
                      </Button>
                      <Button disabled={busy === m.id} onClick={() => { setRevising(m); setNote(''); }}>Request revision</Button>
                    </>
                  )}
                  {trigger === 'release' && <Button variant="mint" disabled={busy === m.id} onClick={() => { void act(m, () => contractsApi.release(contract.id, m.id), 'Released to the expert.'); }}>Release payment</Button>}
                  {side && active && canDisputeMilestone(m) && <button type="button" className={styles.link} onClick={() => { setDisputing(m); setNote(''); }}>Dispute</button>}
                  {m.paymentPending && <span className={styles.muted}>Waiting for the bank to confirm the payment…</span>}
                </div>
              </li>
            );
          })}
        </ol>
      </Panel>

      <Panel className={styles.stack}>
        <h2 className={styles.h2}>Invoices</h2>
        {!invoices ? <Empty message="Loading…" /> : !mine.length ? <p className={styles.muted}>An invoice is issued for each funded milestone.</p> : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Invoice</th><th>Milestone</th><th>Total</th><th>Issued</th><th /></tr></thead>
              <tbody>
                {mine.map((i) => (
                  <tr key={i.id}>
                    <td className={styles.mono}>{i.id}</td>
                    <td>{i.milestoneSeq}. {i.milestoneTitle}</td>
                    <td>{formatMoney(i.total, i.currency)}</td>
                    <td>{new Date(i.issuedAt).toLocaleDateString()}</td>
                    <td><button type="button" className={styles.link} onClick={() => { void downloadInvoicePdf(i.id); }}>Download PDF</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Dialog open={submitting !== null} onOpenChange={(o) => { if (!o) setSubmitting(null); }} title={`Submit: ${submitting?.title ?? ''}`} size="sm"
        description="Describe what you delivered; upload files in Deliverable files first."
        footer={<Button variant="primary" disabled={note.trim().length < 1} onClick={() => { const m = submitting; setSubmitting(null); if (m) void act(m, () => contractsApi.submit(contract.id, m.id, note.trim()), 'Deliverable submitted for review.'); }}>Submit</Button>}>
        <textarea className={styles.textarea} aria-label="Delivery note" value={note} maxLength={4000} onChange={(e) => setNote(e.target.value)} />
      </Dialog>

      <Dialog open={revising !== null} onOpenChange={(o) => { if (!o) setRevising(null); }} title={`Request a revision: ${revising?.title ?? ''}`} size="sm"
        description="Say what needs to change; the escrow stays held until you approve."
        footer={<Button variant="primary" disabled={note.trim().length < 1} onClick={() => { const m = revising; setRevising(null); if (m) void act(m, () => contractsApi.requestRevision(contract.id, m.id, note.trim()), 'Revision requested.'); }}>Request revision</Button>}>
        <textarea className={styles.textarea} aria-label="What needs to change" value={note} maxLength={4000} onChange={(e) => setNote(e.target.value)} />
      </Dialog>

      <Dialog open={disputing !== null} onOpenChange={(o) => { if (!o) setDisputing(null); }} title={`Dispute: ${disputing?.title ?? ''}`} size="sm"
        description="This freezes the contract's escrow until an AsteAI admin resolves it."
        footer={<Button variant="rose" disabled={note.trim().length < 10} onClick={() => { const m = disputing; setDisputing(null); if (m) void act(m, () => contractsApi.dispute(contract.id, m.id, { reasonCode: reason, description: note.trim() }), 'Dispute opened; the contract is frozen while it is reviewed.'); }}>Open dispute</Button>}>
        <div className={styles.stack}>
          <select className={styles.select} aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value)}>
            {DISPUTE_REASON_CODES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
          </select>
          <textarea className={styles.textarea} aria-label="What went wrong (10+ characters)" value={note} maxLength={4000} onChange={(e) => setNote(e.target.value)} />
        </div>
      </Dialog>
    </>
  );
}
