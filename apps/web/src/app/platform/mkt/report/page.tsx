'use client';

import { KPI, PageHeader, Panel, Tag } from '@/components/ui';

export default function MarketingReportPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <PageHeader
        eyebrow="Growth & Marketing"
        title="Marketing Performance & Attribution"
        sub="Acquisition channel return on investment, cost per verified candidate passport, and marketplace liquidity attribution."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        <KPI value="₹106.8" label="Blended CPA per Verified Passport" />
        <KPI value="3.8x" label="LTV / CAC Multiple" />
        <KPI value="68.4%" label="Assessment Completion Rate" />
        <KPI value="₹4.3M" label="Attributed GMV" />
      </div>

      <Panel style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Channel Attribution Breakdown</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left', color: 'var(--fg-3)' }}>
              <th style={{ padding: '8px' }}>Channel</th>
              <th style={{ padding: '8px' }}>Spend</th>
              <th style={{ padding: '8px' }}>Candidates Acquired</th>
              <th style={{ padding: '8px' }}>Passports Certified</th>
              <th style={{ padding: '8px' }}>Effective CPA</th>
              <th style={{ padding: '8px' }}>Attribution</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid var(--line)' }}>
              <td style={{ padding: '8px', fontWeight: 600 }}>LinkedIn Ads</td>
              <td style={{ padding: '8px' }}>₹1,50,000</td>
              <td style={{ padding: '8px' }}>1,404</td>
              <td style={{ padding: '8px' }}>962</td>
              <td style={{ padding: '8px' }}>₹155.9</td>
              <td style={{ padding: '8px' }}><Tag color="mint">High Quality</Tag></td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--line)' }}>
              <td style={{ padding: '8px', fontWeight: 600 }}>Meta & WhatsApp Direct</td>
              <td style={{ padding: '8px' }}>₹80,000</td>
              <td style={{ padding: '8px' }}>890</td>
              <td style={{ padding: '8px' }}>620</td>
              <td style={{ padding: '8px' }}>₹129.0</td>
              <td style={{ padding: '8px' }}><Tag color="mint">High Volume</Tag></td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--line)' }}>
              <td style={{ padding: '8px', fontWeight: 600 }}>Organic & Viral Referrals</td>
              <td style={{ padding: '8px' }}>₹0</td>
              <td style={{ padding: '8px' }}>2,310</td>
              <td style={{ padding: '8px' }}>1,840</td>
              <td style={{ padding: '8px' }}>₹0.0</td>
              <td style={{ padding: '8px' }}><Tag color="gold">Top Efficiency</Tag></td>
            </tr>
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

