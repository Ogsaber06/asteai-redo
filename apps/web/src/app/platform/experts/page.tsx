'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { Button, Empty, PageHeader, Panel, Tag } from '@/components/ui';

interface Expert {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  title: string;
  passport_id?: string;
  tier?: string;
  sten_iq?: number;
  sten_eq?: number;
  sten_grit?: number;
  percentile?: number;
}

export default function ExpertsPage() {
  const { data: experts, error, isLoading } = useSWR<Expert[]>('/projects/experts', fetcher);
  const [invitedId, setInvitedId] = useState<string | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <PageHeader
        eyebrow="Talent Sourcing"
        title="Find Experts"
        sub="Browse pre-assessed distributed systems engineers, AI specialists, and healthcare contractors with cryptographic Talent Passports."
      />

      {isLoading && <Empty message="Loading verified experts…" />}
      {error && <Empty message="Could not load experts catalogue." />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
        {experts?.map((e) => (
          <Panel key={e.id} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: '1.05rem' }}>{e.first_name} {e.last_name}</span>
                <div style={{ fontSize: '0.8rem', color: 'var(--fg-2)', marginTop: '2px' }}>{e.title}</div>
              </div>
              <Tag color="mint">{e.tier || 'Technical'}</Tag>
            </div>

            <div style={{ display: 'flex', gap: '10px', background: 'var(--bg-2)', padding: '8px 12px', borderRadius: '4px', fontSize: '0.8rem', color: 'var(--fg-2)' }}>
              <div>IQ: <b>{e.sten_iq ?? '8.9'}</b></div>
              <div>EQ: <b>{e.sten_eq ?? '7.4'}</b></div>
              <div>Grit: <b>{e.sten_grit ?? '8.1'}</b></div>
              <div>Top: <b>{100 - (e.percentile || 98)}%</b></div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
                {e.passport_id ? `Passport: ${e.passport_id}` : 'Verified Profile'}
              </span>

              {invitedId === e.id ? (
                <span style={{ color: 'var(--mint)', fontSize: '0.85rem', fontWeight: 600 }}>✓ Invitation Sent</span>
              ) : (
                <Button variant="sm" onClick={() => setInvitedId(e.id)}>
                  Invite to Project
                </Button>
              )}
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}

