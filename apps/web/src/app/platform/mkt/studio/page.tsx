'use client';

import { useState } from 'react';
import { Button, Empty, PageHeader, Panel, Tag } from '@/components/ui';

export default function MarketingStudioPage() {
  const [headline, setHeadline] = useState('Hire Top 1% Pre-Vetted Systems Engineers');
  const [targetRole, setTargetRole] = useState('Senior Distributed Systems Engineer');
  const [generated, setGenerated] = useState(true);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <PageHeader
        eyebrow="Growth & Marketing"
        title="Ad Studio"
        sub="Generate high-converting hiring ads, localized job board creatives, and automated employer branding banners."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        <Panel style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Creative Configurator</h3>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--fg-3)', display: 'block', marginBottom: '4px' }}>Target Role</label>
            <input
              type="text"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-1)' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--fg-3)', display: 'block', marginBottom: '4px' }}>Headline</label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-1)' }}
            />
          </div>
          <Button variant="mint" onClick={() => setGenerated(true)}>
            Refresh AI Ad Previews
          </Button>
        </Panel>

        {generated && (
          <Panel style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'linear-gradient(135deg, rgba(20, 24, 38, 0.9), rgba(12, 14, 24, 0.95))', border: '1px solid var(--blue)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--blue)', fontWeight: 600, textTransform: 'uppercase' }}>Preview: LinkedIn / Twitter Card</span>
              <Tag color="mint">Ready</Tag>
            </div>
            <h2 style={{ margin: '8px 0', fontSize: '1.3rem', color: '#fff' }}>{headline}</h2>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--fg-2)' }}>
              Verified through AsteAI psychometric batteries: Reasoning (IQ), Team EQ, and Persistence. Fast-track your hiring pipeline today.
            </p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <Tag color="gold">Verified Passports</Tag>
              <Tag color="mint">48-Hr SLA</Tag>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}

