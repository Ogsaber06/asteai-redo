'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useAuthStore } from '@/store/auth';
import { api, errorMessage, fetcher } from '@/lib/api';
import { Button, Empty, PageHeader, Panel, Tag } from '@/components/ui';

interface DisputeItem {
  id: string;
  project_id?: string;
  project_title?: string;
  raised_by: string;
  raised_by_name?: string;
  raised_against: string;
  raised_against_name?: string;
  reason: string;
  status: string;
  resolution?: string;
  timeline?: { date: string; note: string }[];
  created_at: string;
}

export default function DisputesPage() {
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'Admin';

  const { data: disputes, error, isLoading, mutate } = useSWR<DisputeItem[]>('/projects/disputes', fetcher);

  const [openModal, setOpenModal] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [raisedAgainst, setRaisedAgainst] = useState('44444444-4444-4444-4444-444444444444');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState('');

  async function handleFileDispute(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/projects/disputes', {
        projectId: projectId.trim() || undefined,
        raisedAgainst,
        reason: reason.trim(),
      });
      setReason('');
      setOpenModal(false);
      void mutate();
    } catch (err) {
      alert(errorMessage(err, 'Failed to file dispute'));
    } finally {
      setBusy(false);
    }
  }

  async function handleResolve(id: string) {
    setBusy(true);
    try {
      await api.patch(`/projects/disputes/${encodeURIComponent(id)}/resolve`, {
        resolution: resolutionText.trim() || 'Arbitrated by platform ops',
      });
      setResolvingId(null);
      setResolutionText('');
      void mutate();
    } catch (err) {
      alert(errorMessage(err, 'Failed to resolve dispute'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <PageHeader
        eyebrow="Trust & Security"
        title="Disputes & Appeals"
        sub="Escrow arbitration system, contract deliverable claims, and mutual resolution logs."
        actions={
          !isAdmin && (
            <Button variant="rose" onClick={() => setOpenModal(true)}>
              + Raise Milestone Dispute
            </Button>
          )
        }
      />

      {isLoading && <Empty message="Loading disputes registry…" />}
      {error && <Empty message="Could not load disputes." />}

      {openModal && (
        <Panel style={{ display: 'flex', flexDirection: 'column', gap: '14px', border: '1px solid var(--rose)' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>File Contract Dispute</h3>
          <form onSubmit={handleFileDispute} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--fg-3)', display: 'block', marginBottom: '4px' }}>Project ID</label>
              <input
                type="text"
                placeholder="e.g. PRJ-1037"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-1)' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--fg-3)', display: 'block', marginBottom: '4px' }}>Dispute Reason & Specific Breach</label>
              <textarea
                required
                rows={3}
                placeholder="Detail milestone discrepancy, code quality deviation, or deadline violation..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-1)' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Button type="submit" variant="rose" disabled={busy}>Submit Dispute Claim</Button>
              <Button type="button" onClick={() => setOpenModal(false)}>Cancel</Button>
            </div>
          </form>
        </Panel>
      )}

      {disputes && disputes.length === 0 && (
        <Empty message="No active or pending dispute claims on file." />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {disputes?.map((d) => (
          <Panel key={d.id} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: '1rem' }}>Dispute {d.id}</span>
                <span style={{ marginLeft: '10px', fontSize: '0.8rem', color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
                  Project: {d.project_title || d.project_id || 'Contract'}
                </span>
              </div>
              <Tag color={d.status === 'Resolved' ? 'mint' : 'rose'}>{d.status}</Tag>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--fg-2)', background: 'var(--bg-2)', padding: '10px', borderRadius: '4px' }}>
              <b>Claim:</b> {d.reason}
            </div>

            {d.resolution && (
              <div style={{ fontSize: '0.85rem', color: 'var(--mint)', background: 'var(--bg-1)', padding: '8px', borderRadius: '4px', border: '1px solid var(--line)' }}>
                <b>Resolution:</b> {d.resolution}
              </div>
            )}

            {isAdmin && d.status !== 'Resolved' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                {resolvingId === d.id ? (
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Enter binding arbitration ruling (e.g., '50% refunded to buyer, 50% released to expert')..."
                      value={resolutionText}
                      onChange={(e) => setResolutionText(e.target.value)}
                      style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-1)' }}
                    />
                    <Button variant="mint" disabled={busy} onClick={() => handleResolve(d.id)}>Confirm Ruling</Button>
                    <Button onClick={() => setResolvingId(null)}>Cancel</Button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button variant="sm" onClick={() => { setResolvingId(d.id); setResolutionText(''); }}>
                      Arbitrate & Resolve…
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Panel>
        ))}
      </div>
    </div>
  );
}

