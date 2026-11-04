'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useAuthStore } from '@/store/auth';
import type { Milestone, Project } from '@asteai/types';
import { api, errorMessage, fetcher } from '@/lib/api';
import { Button, Empty, KPI, PageHeader, Panel, Tag } from '@/components/ui';

export default function ContractsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const isFreelancer = role === 'Freelancer';
  const endpoint = isFreelancer ? '/projects/assigned' : '/projects/mine';

  const { data: projects, error, isLoading, mutate } = useSWR<Project[]>(endpoint, fetcher);
  const [busyMilestone, setBusyMilestone] = useState<string | null>(null);

  async function handleMilestoneAction(projectId: string, milestoneId: string, nextStatus: 'Submitted' | 'Released') {
    setBusyMilestone(milestoneId);
    try {
      await api.patch(`/projects/${encodeURIComponent(projectId)}/milestones/${encodeURIComponent(milestoneId)}`, {
        status: nextStatus,
      });
      void mutate();
    } catch (err) {
      alert(errorMessage(err, 'Failed to update milestone status'));
    } finally {
      setBusyMilestone(null);
    }
  }

  const totalContractValue = projects?.reduce((sum, p) => sum + (p.budget || 0), 0) ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <PageHeader
        eyebrow="Marketplace"
        title="Escrow Contracts"
        sub="Track active contract deliverables, review milestone submissions, and release escrow funds securely."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        <KPI value={projects?.length.toString() ?? '0'} label="Active Contracts" />
        <KPI value={`₹${totalContractValue.toLocaleString('en-IN')}`} label="Total Contract Volume" />
        <KPI value="100% Guaranteed" label="Escrow Protection" />
      </div>

      {isLoading && <Empty message="Loading active contracts…" />}
      {error && <Empty message="Could not load contracts." />}

      {projects && projects.length === 0 && (
        <Empty message="No active contracts found. Once a proposal is awarded, contract milestones appear here." />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {projects?.map((p) => (
          <Panel key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: '1.05rem' }}>{p.title}</span>
                <span style={{ marginLeft: '10px', fontSize: '0.8rem', color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
                  ID: {p.id} · Domain: {p.domain}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Tag color="mint">₹{p.budget?.toLocaleString('en-IN')}</Tag>
                <Tag color={p.stage === 'In Progress' ? 'amber' : 'mint'}>{p.stage}</Tag>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--fg-2)' }}>{p.description}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--fg-2)' }}>Contract Milestones:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {p.milestones?.map((m: Milestone) => {
                  const isReleased = m.status === 'Released';
                  const isPending = m.status === 'Pending';
                  const isFunded = m.status === 'Funded';

                  return (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px',
                        background: 'var(--bg-2)',
                        borderRadius: '4px',
                        border: '1px solid var(--line)',
                        flexWrap: 'wrap',
                        gap: '8px',
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>{m.name}</span>
                        <span style={{ marginLeft: '10px', color: 'var(--fg-3)', fontSize: '0.8rem' }}>
                          ₹{m.amount.toLocaleString('en-IN')}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <Tag color={isReleased ? 'mint' : isFunded ? 'amber' : 'grey'}>{m.status}</Tag>

                        {isFreelancer && (isPending || isFunded) && (
                          <Button
                            variant="sm"
                            disabled={busyMilestone === m.id}
                            onClick={() => handleMilestoneAction(p.id, m.id, 'Submitted')}
                          >
                            Submit Deliverable
                          </Button>
                        )}

                        {!isFreelancer && !isReleased && (
                          <Button
                            variant="mint"
                            variantSize="sm"
                            disabled={busyMilestone === m.id}
                            onClick={() => handleMilestoneAction(p.id, m.id, 'Released')}
                          >
                            Release Escrow Payout
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}

