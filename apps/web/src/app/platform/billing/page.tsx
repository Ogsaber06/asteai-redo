'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useAuthStore } from '@/store/auth';
import { api, errorMessage, fetcher } from '@/lib/api';
import { Button, Empty, KPI, PageHeader, Panel, Tag } from '@/components/ui';

interface TenantDetail {
  id: string;
  name: string;
  plan: string;
  credits: number;
  seats: number;
  domain: string;
}

interface LedgerEntry {
  id: string;
  type: string;
  description: string;
  amount: string;
  fee?: string;
  by: string;
  created_at: string;
}

export default function BillingPage() {
  const tenantId = useAuthStore((s) => s.user?.tenantId);
  const { data: tenant, mutate: mutateTenant } = useSWR<TenantDetail>(
    tenantId ? `/tenants/${encodeURIComponent(tenantId)}` : null,
    fetcher,
  );
  const { data: ledger, mutate: mutateLedger } = useSWR<LedgerEntry[]>('/ledger', fetcher);

  const [topUpAmount, setTopUpAmount] = useState(500);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleTopUp() {
    if (!tenantId) return;
    setBusy(true);
    setSuccess(false);
    try {
      await api.post(`/tenants/${encodeURIComponent(tenantId)}/credits`, { amount: Number(topUpAmount) });
      setSuccess(true);
      void mutateTenant();
      void mutateLedger();
    } catch (err) {
      alert(errorMessage(err, 'Failed to purchase credits'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <PageHeader
        eyebrow="Account"
        title="Billing & Credits"
        sub="Assessment balance, billing plan overview, and audit ledger of credit consumption."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        <KPI value={tenant?.credits ?? '0'} label="Assessment Credits" />
        <KPI value={tenant?.plan ?? 'Enterprise'} label="Current Tier" />
        <KPI value={tenant?.seats ?? '10'} label="Seat Allocation" />
        <KPI value="₹0.00" label="Outstanding Balance" />
      </div>

      <Panel style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Purchase Assessment Credits</h3>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--fg-2)' }}>
          Each candidate battery consumption deducts 1 credit per skill module. Purchased credits never expire.
        </p>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {[250, 500, 1000, 2500].map((amt) => (
            <Button
              key={amt}
              variant={topUpAmount === amt ? 'primary' : 'default'}
              onClick={() => setTopUpAmount(amt)}
            >
              +{amt} Credits
            </Button>
          ))}
          <Button variant="mint" disabled={busy} onClick={handleTopUp}>
            {busy ? 'Processing…' : `Purchase ${topUpAmount} Credits`}
          </Button>
        </div>

        {success && (
          <div style={{ padding: '8px 12px', background: 'var(--bg-2)', border: '1px solid var(--mint)', borderRadius: '4px', fontSize: '0.85rem', color: 'var(--fg-1)' }}>
            ✅ Successfully credited <b>{topUpAmount} credits</b> to your account!
          </div>
        )}
      </Panel>

      <Panel style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Ledger Transactions</h3>
        {ledger && ledger.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left', color: 'var(--fg-3)' }}>
                <th style={{ padding: '8px' }}>Date</th>
                <th style={{ padding: '8px' }}>Reference</th>
                <th style={{ padding: '8px' }}>Description</th>
                <th style={{ padding: '8px' }}>Type</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Credits / Amount</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((tx) => {
                const amt = Number(tx.amount);
                return (
                  <tr key={tx.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '8px', color: 'var(--fg-3)' }}>{new Date(tx.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: '8px', fontFamily: 'var(--font-mono)' }}>{tx.id}</td>
                    <td style={{ padding: '8px' }}>{tx.description}</td>
                    <td style={{ padding: '8px' }}><Tag color={amt >= 0 ? 'mint' : 'grey'}>{tx.type}</Tag></td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600, color: amt >= 0 ? 'var(--mint)' : 'var(--fg-1)' }}>
                      {amt >= 0 ? `+${amt}` : amt}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty message="No billing ledger transactions found." />
        )}
      </Panel>
    </div>
  );
}

