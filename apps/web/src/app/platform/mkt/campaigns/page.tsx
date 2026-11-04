'use client';

import { useState } from 'react';
import { Button, Empty, KPI, PageHeader, Panel, Tag } from '@/components/ui';

interface MktCampaign {
  id: string;
  name: string;
  channel: string;
  budget: string;
  impressions: number;
  clicks: number;
  signups: number;
  status: string;
}

const INITIAL_CAMPAIGNS: MktCampaign[] = [
  { id: 'CAMP-1', name: 'Q4 Tech Talent Inbound Sprint', channel: 'LinkedIn & GitHub', budget: '₹1,50,000', impressions: 48200, clicks: 3120, signups: 420, status: 'Active' },
  { id: 'CAMP-2', name: 'Frontline Healthcare Recruitment South', channel: 'Meta & WhatsApp', budget: '₹80,000', impressions: 92400, clicks: 5410, signups: 890, status: 'Active' },
  { id: 'CAMP-3', name: 'Marketplace Buyer Acquisition Q4', channel: 'Google Search Ads', budget: '₹2,00,000', impressions: 24100, clicks: 1840, signups: 94, status: 'Completed' },
];

export default function MarketingCampaignsPage() {
  const [campaigns, setCampaigns] = useState<MktCampaign[]>(INITIAL_CAMPAIGNS);
  const [openModal, setOpenModal] = useState(false);
  const [name, setName] = useState('');
  const [channel, setChannel] = useState('LinkedIn Ads');
  const [budget, setBudget] = useState('₹50,000');

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const newCamp: MktCampaign = {
      id: `CAMP-${Math.floor(Math.random() * 900) + 100}`,
      name,
      channel,
      budget,
      impressions: 1200,
      clicks: 80,
      signups: 12,
      status: 'Active',
    };
    setCampaigns([newCamp, ...campaigns]);
    setName('');
    setOpenModal(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <PageHeader
        eyebrow="Growth & Marketing"
        title="Marketing Campaigns"
        sub="Track paid advertising channels, cost-per-acquisition (CPA), and marketplace candidate growth."
        actions={
          <Button variant="primary" onClick={() => setOpenModal(true)}>
            + Create Campaign
          </Button>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        <KPI value="164,700" label="Total Impressions" />
        <KPI value="10,370" label="Ad Clicks" />
        <KPI value="1,404" label="Candidate Signups" />
        <KPI value="6.3%" label="Avg Click-Through Rate" />
      </div>

      {openModal && (
        <Panel style={{ display: 'flex', flexDirection: 'column', gap: '14px', border: '1px solid var(--blue)' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Create Growth Campaign</h3>
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--fg-3)', display: 'block', marginBottom: '4px' }}>Campaign Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-1)' }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--fg-3)', display: 'block', marginBottom: '4px' }}>Ad Channel</label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-1)' }}
                >
                  <option value="LinkedIn Ads">LinkedIn Ads</option>
                  <option value="Google Ads">Google Ads</option>
                  <option value="Meta Ads">Meta Ads</option>
                  <option value="GitHub Ads">GitHub Ads</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--fg-3)', display: 'block', marginBottom: '4px' }}>Budget</label>
                <input
                  type="text"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-1)' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Button type="submit" variant="mint">Launch Campaign</Button>
              <Button type="button" onClick={() => setOpenModal(false)}>Cancel</Button>
            </div>
          </form>
        </Panel>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
        {campaigns.map((c) => (
          <Panel key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: '1rem' }}>{c.name}</span>
              <Tag color={c.status === 'Active' ? 'mint' : 'grey'}>{c.status}</Tag>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
              Channel: {c.channel} · Budget: {c.budget}
            </div>
            <div style={{ display: 'flex', gap: '14px', fontSize: '0.85rem', color: 'var(--fg-2)', background: 'var(--bg-2)', padding: '8px', borderRadius: '4px' }}>
              <div>Impressions: <b>{c.impressions.toLocaleString()}</b></div>
              <div>Clicks: <b>{c.clicks.toLocaleString()}</b></div>
              <div>Signups: <b>{c.signups.toLocaleString()}</b></div>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}

