'use client';

import { useState } from 'react';
import { Button, Empty, PageHeader, Panel, Tag } from '@/components/ui';

interface AudienceSegment {
  id: string;
  name: string;
  size: number;
  criteria: string;
  source: string;
}

const INITIAL_AUDIENCES: AudienceSegment[] = [
  { id: 'AUD-1', name: 'Verified Distributed Systems Contractors', size: 1420, criteria: 'Passed Technical Tier, Sten IQ >= 8.0, Go/Rust/Kafka skills', source: 'AsteAI Passports' },
  { id: 'AUD-2', name: 'Clinical Healthcare & ICU Nursing Specialists', size: 3890, criteria: 'BLS/ACLS certified, Kannada/English, Tier: Frontline', source: 'Hospital CRM' },
  { id: 'AUD-3', name: 'Bengaluru Logistics & Fleet Route Planners', size: 840, criteria: 'Supply chain analytics, SQL/Python, 3+ yrs experience', source: 'Inbound Sourcing' },
];

export default function MarketingAudiencesPage() {
  const [audiences, setAudiences] = useState<AudienceSegment[]>(INITIAL_AUDIENCES);
  const [openModal, setOpenModal] = useState(false);
  const [name, setName] = useState('');
  const [criteria, setCriteria] = useState('');
  const [source, setSource] = useState('AsteAI Platform');

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const newAud: AudienceSegment = {
      id: `AUD-${Math.floor(Math.random() * 900) + 100}`,
      name,
      size: Math.floor(Math.random() * 1000) + 200,
      criteria,
      source,
    };
    setAudiences([newAud, ...audiences]);
    setName('');
    setCriteria('');
    setOpenModal(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <PageHeader
        eyebrow="Growth & Marketing"
        title="Audience Segments"
        sub="Build targeted demographic and skill-indexed audience segments for ad re-targeting and outbound outreach."
        actions={
          <Button variant="primary" onClick={() => setOpenModal(true)}>
            + Create Segment
          </Button>
        }
      />

      {openModal && (
        <Panel style={{ display: 'flex', flexDirection: 'column', gap: '14px', border: '1px solid var(--blue)' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Create Audience Segment</h3>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--fg-3)', display: 'block', marginBottom: '4px' }}>Segment Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-1)' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--fg-3)', display: 'block', marginBottom: '4px' }}>Filtering Criteria & Tech Skills</label>
              <input
                type="text"
                required
                placeholder="e.g. Sten IQ >= 7.5, Python, AWS RDS, Kubernetes"
                value={criteria}
                onChange={(e) => setCriteria(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-1)' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Button type="submit" variant="mint">Build Audience</Button>
              <Button type="button" onClick={() => setOpenModal(false)}>Cancel</Button>
            </div>
          </form>
        </Panel>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
        {audiences.map((a) => (
          <Panel key={a.id} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: '1rem' }}>{a.name}</span>
              <Tag color="mint">{a.size.toLocaleString()} Users</Tag>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
              Source: {a.source} · ID: {a.id}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--fg-2)', background: 'var(--bg-2)', padding: '8px', borderRadius: '4px' }}>
              <b>Rules:</b> {a.criteria}
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}

