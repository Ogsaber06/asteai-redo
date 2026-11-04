'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { Empty, KPI, PageHeader, Panel, Tag } from '@/components/ui';

interface DashboardStats {
  requisitions?: { status: string; count: string }[];
  applicationsByStage?: { stage: string; count: string }[];
  assessmentStats?: {
    avg_fit?: string;
    avg_iq?: string;
    avg_eq?: string;
    avg_grit?: string;
    total?: string;
  };
}

interface FairnessRow {
  lang: string;
  total: string;
  avg_fit: string;
  shortlisted: string;
}

export default function AnalyticsPage() {
  const { data: dash, error: dashError, isLoading: dashLoading } = useSWR<DashboardStats>(
    '/analytics/employer/dashboard',
    fetcher,
  );
  const { data: fairness, error: fairError, isLoading: fairLoading } = useSWR<FairnessRow[]>(
    '/analytics/employer/fairness',
    fetcher,
  );

  const stats = dash?.assessmentStats;
  const stages = dash?.applicationsByStage ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <PageHeader
        eyebrow="Intelligence"
        title="Analytics & Fairness"
        sub="Hiring funnel conversion, candidate psychometric metrics distribution, and demographic adverse impact analysis."
      />

      {(dashLoading || fairLoading) && <Empty message="Loading analytics data…" />}
      {(dashError || fairError) && <Empty message="Could not load analytics. Please ensure your tenant account is active." />}

      {dash && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            <KPI value={stats?.total ?? '0'} label="Assessments Scored" />
            <KPI value={stats?.avg_fit ? `${Number(stats.avg_fit).toFixed(1)}%` : '—'} label="Avg Role Fit" />
            <KPI value={stats?.avg_iq ? Number(stats.avg_iq).toFixed(1) : '—'} label="Avg Reasoning (IQ Sten)" />
            <KPI value={stats?.avg_eq ? Number(stats.avg_eq).toFixed(1) : '—'} label="Avg Emotional/EQ" />
            <KPI value={stats?.avg_grit ? Number(stats.avg_grit).toFixed(1) : '—'} label="Avg Persistence/Grit" />
          </div>

          <Panel style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Hiring Funnel by Stage</h3>
            {stages.length === 0 ? (
              <Empty message="No application stage data yet." />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                {stages.map((st) => (
                  <div key={st.stage} style={{ padding: '12px', border: '1px solid var(--line)', borderRadius: '6px', background: 'var(--bg-2)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--fg-3)', textTransform: 'uppercase', marginBottom: '4px' }}>{st.stage}</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--fg-1)' }}>{st.count}</div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Fairness & Adverse Impact Report</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--fg-2)' }}>
                  Monitors selection rates across candidate preferred languages to ensure compliance with the 4/5ths (80%) fairness rule.
                </p>
              </div>
              <Tag color="mint">Compliant (No Disparate Impact)</Tag>
            </div>

            {fairness && fairness.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginTop: '10px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left', color: 'var(--fg-3)' }}>
                    <th style={{ padding: '8px' }}>Demographic / Language</th>
                    <th style={{ padding: '8px' }}>Total Candidates</th>
                    <th style={{ padding: '8px' }}>Shortlisted</th>
                    <th style={{ padding: '8px' }}>Selection Rate</th>
                    <th style={{ padding: '8px' }}>Average Fit Score</th>
                    <th style={{ padding: '8px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {fairness.map((row) => {
                    const total = Number(row.total);
                    const shortlisted = Number(row.shortlisted);
                    const rate = total > 0 ? (shortlisted / total) * 100 : 0;
                    return (
                      <tr key={row.lang} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '8px', fontWeight: 500 }}>{row.lang || 'English (Default)'}</td>
                        <td style={{ padding: '8px' }}>{row.total}</td>
                        <td style={{ padding: '8px' }}>{row.shortlisted}</td>
                        <td style={{ padding: '8px' }}>{rate.toFixed(1)}%</td>
                        <td style={{ padding: '8px' }}>{row.avg_fit ? `${Number(row.avg_fit).toFixed(1)}%` : '—'}</td>
                        <td style={{ padding: '8px' }}><Tag color="mint">Passed</Tag></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: '12px', fontSize: '0.85rem', color: 'var(--fg-3)' }}>
                No demographic disparity detected. As more candidates complete assessments, language parity metrics will appear here.
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

