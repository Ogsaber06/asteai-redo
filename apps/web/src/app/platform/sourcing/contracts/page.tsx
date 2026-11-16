'use client';

import Link from 'next/link';
import useSWR from 'swr';
import type { ContractSummary } from '@asteai/types';
import { fetcher } from '@/lib/api';
import { Empty, PageHeader, Tag } from '@/components/ui';
import { formatMoney, STATUS_LABEL, statusColor } from '@/features/contracts';
import { escrowSummary } from '@/features/sourcing/format';
import styles from '@/features/sourcing/Sourcing.module.css';

/** Projects & escrow contracts with how much of each is funded, held and released. */
export default function SourcingContractsPage() {
  const { data, error } = useSWR<ContractSummary[]>('/contracts', fetcher);
  return (
    <>
      <PageHeader eyebrow="Talent Sourcing" title="Projects & escrow" sub="Every contract, its escrow and where each milestone stands." />
      {error ? <Empty message="Could not load contracts." /> : !data ? <Empty message="Loading…" /> : !data.length ? (
        <Empty message="No contracts yet. Award a proposal or order a service to start one." />
      ) : (
        <ul className={styles.cards}>
          {data.map((c) => {
            const s = escrowSummary(c);
            const pct = (n: number) => `${s.total ? (n / s.total) * 100 : 0}%`;
            return (
              <li key={c.id}>
                <Link href={`/platform/sourcing/contracts/${encodeURIComponent(c.id)}`} className={styles.card}>
                  <div className={styles.between}><strong>{c.title}</strong><Tag color={statusColor(c.status)}>{STATUS_LABEL[c.status]}</Tag></div>
                  <span className={styles.muted}>{c.id} · {formatMoney(s.total, c.currency)}</span>
                  <div className={styles.escrowBar} aria-hidden="true">
                    <span className={styles.barReleased} style={{ width: pct(s.released) }} />
                    <span className={styles.barHeld} style={{ width: pct(s.held) }} />
                  </div>
                  <span className={styles.muted}>Released {formatMoney(s.released, c.currency)} · in escrow {formatMoney(s.held, c.currency)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
