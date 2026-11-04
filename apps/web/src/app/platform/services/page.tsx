'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { Button, Empty, PageHeader, Panel, Tag } from '@/components/ui';

interface ServicePackage {
  id: string;
  title: string;
  domain: string;
  price: number;
  days: number;
  description: string;
  expertName: string;
  rating: number;
}

export default function ServicesPage() {
  const { data: services, isLoading } = useSWR<ServicePackage[]>('/projects/services', fetcher);
  const [bookedId, setBookedId] = useState<string | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <PageHeader
        eyebrow="Talent Sourcing"
        title="Pre-Packaged Services"
        sub="Fixed-scope, turnkey engineering packages with upfront escrow pricing and guaranteed milestone turnaround."
      />

      {isLoading && <Empty message="Loading service offerings…" />}

      {bookedId && (
        <div style={{ padding: '12px', background: 'var(--bg-2)', border: '1px solid var(--mint)', borderRadius: '6px', fontSize: '0.85rem' }}>
          🎉 <b>Service Package Booked:</b> Order placed for package <b>{bookedId}</b>. Escrow hold initialized and expert notified.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
        {services?.map((s) => (
          <Panel key={s.id} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: '1rem' }}>{s.title}</span>
              <Tag color="mint">₹{s.price.toLocaleString('en-IN')}</Tag>
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
              Domain: {s.domain} · Delivery: {s.days} Days · ★ {s.rating}
            </div>

            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--fg-2)', lineHeight: 1.4 }}>
              {s.description}
            </p>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', paddingTop: '8px', borderTop: '1px solid var(--line)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--fg-2)' }}>
                Provider: <b>{s.expertName}</b>
              </span>
              <Button variant="sm" onClick={() => setBookedId(s.id)}>
                Order Package
              </Button>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}

