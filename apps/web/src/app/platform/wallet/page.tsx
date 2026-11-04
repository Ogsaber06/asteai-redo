'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, errorMessage, fetcher } from '@/lib/api';
import { Button, Empty, KPI, PageHeader, Panel, Tag } from '@/components/ui';

interface WalletStats {
  earned: string;
  fees: string;
  pending: string;
}

interface LedgerTx {
  id: string;
  type: string;
  description: string;
  amount: string;
  fee?: string;
  by: string;
  created_at: string;
}

export default function WalletPage() {
  const { data: wallet, mutate: mutateWallet } = useSWR<WalletStats>('/ledger/wallet', fetcher);
  const { data: entries, mutate: mutateEntries } = useSWR<LedgerTx[]>('/ledger/entries', fetcher);

  const [depositAmount, setDepositAmount] = useState(25000);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleDeposit() {
    setBusy(true);
    setSuccess(false);
    try {
      await api.post('/ledger/deposit', { amount: Number(depositAmount), description: 'Self-serve wallet deposit' });
      setSuccess(true);
      void mutateWallet();
      void mutateEntries();
    } catch (err) {
      alert(errorMessage(err, 'Failed to deposit funds'));
    } finally {
      setBusy(false);
    }
  }

  const earnedNum = Number(wallet?.earned || 0);
  const feesNum = Number(wallet?.fees || 0);
  const pendingNum = Number(wallet?.pending || 0);
  const available = Math.max(0, earnedNum - feesNum);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <PageHeader
        eyebrow="Finance & Payouts"
        title="Wallet & Escrow"
        sub="Instant INR payouts, escrow accounts balance, deposit project funding, and transaction ledgers."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        <KPI value={`₹${available.toLocaleString('en-IN')}`} label="Available Balance" />
        <KPI value={`₹${pendingNum.toLocaleString('en-IN')}`} label="Escrow Held" />
        <KPI value={`₹${earnedNum.toLocaleString('en-IN')}`} label="Total Gross Volume" />
        <KPI value={`₹${feesNum.toLocaleString('en-IN')}`} label="Platform Fees (5%)" />
      </div>

      <Panel style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Deposit / Add Wallet Funds</h3>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--fg-2)' }}>
          Fund your wallet via UPI, NetBanking, or corporate wire to fund project escrow milestones.
        </p>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {[10000, 25000, 50000, 100000].map((amt) => (
            <Button
              key={amt}
              variant={depositAmount === amt ? 'primary' : 'default'}
              onClick={() => setDepositAmount(amt)}
            >
              +₹{amt.toLocaleString('en-IN')}
            </Button>
          ))}
          <Button variant="mint" disabled={busy} onClick={handleDeposit}>
            {busy ? 'Processing Deposit…' : `Add ₹${depositAmount.toLocaleString('en-IN')}`}
          </Button>
        </div>

        {success && (
          <div style={{ padding: '8px 12px', background: 'var(--bg-2)', border: '1px solid var(--mint)', borderRadius: '4px', fontSize: '0.85rem', color: 'var(--fg-1)' }}>
            ✓ Successfully added <b>₹{depositAmount.toLocaleString('en-IN')}</b> to your available balance!
          </div>
        )}
      </Panel>

      <Panel style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Recent Ledger Activity</h3>
        {entries && entries.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)', textAlign: 'left', color: 'var(--fg-3)' }}>
                <th style={{ padding: '8px' }}>Date</th>
                <th style={{ padding: '8px' }}>Reference</th>
                <th style={{ padding: '8px' }}>Description</th>
                <th style={{ padding: '8px' }}>Type</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((tx) => {
                const amt = Number(tx.amount);
                return (
                  <tr key={tx.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '8px', color: 'var(--fg-3)' }}>{new Date(tx.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: '8px', fontFamily: 'var(--font-mono)' }}>{tx.id}</td>
                    <td style={{ padding: '8px' }}>{tx.description}</td>
                    <td style={{ padding: '8px' }}><Tag color={amt >= 0 ? 'mint' : 'grey'}>{tx.type}</Tag></td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600, color: amt >= 0 ? 'var(--mint)' : 'var(--fg-1)' }}>
                      ₹{Math.abs(amt).toLocaleString('en-IN')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty message="No recent wallet transactions recorded." />
        )}
      </Panel>
    </div>
  );
}

