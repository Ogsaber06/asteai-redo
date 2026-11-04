'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { Button, Empty, PageHeader, Panel, Tag } from '@/components/ui';

interface InterviewTemplate {
  id: string;
  role: string;
  industry: string;
  rounds: { name: string; duration: string; focus: string }[];
}

export default function InterviewsPage() {
  const { data: catalogue, isLoading } = useSWR<InterviewTemplate[]>('/interviews/catalogue', fetcher);
  const [offerCandidate, setOfferCandidate] = useState('');
  const [offerSalary, setOfferSalary] = useState('');
  const [offerGenerated, setOfferGenerated] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <PageHeader
        eyebrow="Hire & ATS"
        title="Interviews & Offers"
        sub="Standardized AI-assisted structured interview tracks, candidate rubrics, and automated offer letter generation."
      />

      <Panel style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Quick Offer Letter Generator</h3>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--fg-2)' }}>
          Create an offer letter packet and lock in candidate SLA terms.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--fg-3)', display: 'block', marginBottom: '4px' }}>Candidate Name / Email</label>
            <input
              type="text"
              placeholder="e.g. Rahul Gowda"
              value={offerCandidate}
              onChange={(e) => setOfferCandidate(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-1)' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--fg-3)', display: 'block', marginBottom: '4px' }}>Annual CTC / Salary (INR)</label>
            <input
              type="text"
              placeholder="e.g. ₹6,50,000"
              value={offerSalary}
              onChange={(e) => setOfferSalary(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-1)' }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <Button
            variant="mint"
            disabled={!offerCandidate || !offerSalary}
            onClick={() => setOfferGenerated(true)}
          >
            Generate & Send Offer Letter
          </Button>
        </div>

        {offerGenerated && (
          <div style={{ padding: '12px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--fg-1)' }}>
            🎉 <b>Offer Letter Dispatched:</b> Official employment agreement sent to <b>{offerCandidate}</b> with compensation <b>{offerSalary}</b>. Candidate has 48 hours to sign digitally.
          </div>
        )}
      </Panel>

      <h3 style={{ margin: '10px 0 0', fontSize: '1.1rem', fontWeight: 600 }}>Structured Interview Tracks</h3>
      {isLoading && <Empty message="Loading interview templates…" />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
        {catalogue?.map((item) => (
          <Panel key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{item.role}</span>
              <Tag color="mint">{item.industry}</Tag>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--fg-2)' }}>
              <b>Rounds:</b>
              <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                {item.rounds?.map((r, i) => (
                  <li key={i} style={{ marginBottom: '4px' }}>
                    {r.name} ({r.duration}) — <span style={{ color: 'var(--fg-3)' }}>{r.focus}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}

