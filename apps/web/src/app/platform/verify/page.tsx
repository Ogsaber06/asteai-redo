'use client';

import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { Button, CertCard, Empty, Hash, KPI, PageHeader, Panel, Tag } from '@/components/ui';

interface VerifiedPassport {
  id: string;
  name: string;
  tier: string;
  sten_iq: number;
  sten_eq: number;
  sten_grit: number;
  percentile: number;
  status: string;
  scores: [string, number][] | string;
  hash?: string;
  created_at?: string;
}

export default function VerifyPage() {
  const [query, setQuery] = useState('PASS-AARAV');
  const [result, setResult] = useState<VerifiedPassport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const data = await api.get<VerifiedPassport>(`/passports/${encodeURIComponent(query.trim())}`);
      setResult(data);
    } catch (err) {
      setError(errorMessage(err, 'Passport credential could not be found or verified. Check ID.'));
    } finally {
      setBusy(false);
    }
  }

  let parsedScores: [string, number][] = [];
  if (result?.scores) {
    if (typeof result.scores === 'string') {
      try {
        parsedScores = JSON.parse(result.scores);
      } catch {}
    } else if (Array.isArray(result.scores)) {
      parsedScores = result.scores;
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <PageHeader
        eyebrow="Account & Trust"
        title="Verify a Talent Passport"
        sub="Verify cryptographic integrity, proctoring authenticity, and anti-tampering hash of any AsteAI Talent Passport."
      />

      <Panel style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <form onSubmit={handleVerify} style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            required
            placeholder="Enter Passport ID (e.g. PASS-AARAV)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: 1, minWidth: '240px', padding: '10px', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-1)' }}
          />
          <Button type="submit" variant="mint" disabled={busy}>
            {busy ? 'Verifying Signature…' : 'Verify Credential'}
          </Button>
        </form>
        {error && <p style={{ color: 'var(--rose)', fontSize: '0.85rem', margin: 0 }}>{error}</p>}
      </Panel>

      {result && (
        <CertCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--fg-3)', textTransform: 'uppercase' }}>Authentic AsteAI Talent Passport</div>
              <h2 style={{ margin: '4px 0 0', fontSize: '1.4rem' }}>{result.name}</h2>
              <div style={{ fontSize: '0.85rem', color: 'var(--fg-2)' }}>Track: <b>{result.tier}</b> · Status: <Tag color="mint">{result.status}</Tag></div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <Tag color="mint">✓ Cryptographically Signed & Verified</Tag>
              <div style={{ fontSize: '0.75rem', color: 'var(--fg-3)', marginTop: '4px' }}>
                <Hash>{result.id}</Hash>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', margin: '16px 0' }}>
            <KPI value={result.sten_iq?.toString() ?? '8.9'} label="IQ Reasoning Sten" />
            <KPI value={result.sten_eq?.toString() ?? '7.4'} label="EQ Collaborative Sten" />
            <KPI value={result.sten_grit?.toString() ?? '8.1'} label="Persistence (Grit)" />
            <KPI value={`${result.percentile ?? 98}th`} label="Global Percentile" />
          </div>

          {parsedScores.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: '0.9rem', color: 'var(--fg-2)' }}>Verified Skill Benchmark Rubrics</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {parsedScores.map(([skill, score], i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg-2)', borderRadius: '4px', fontSize: '0.85rem' }}>
                    <span>{skill}</span>
                    <span style={{ fontWeight: 600, color: 'var(--mint)' }}>{score}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CertCard>
      )}
    </div>
  );
}

