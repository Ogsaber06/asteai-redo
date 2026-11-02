'use client';

import useSWR from 'swr';
import { api } from '@/lib/api';
import { Panel, Tag, Button, KPI, Empty, Eyebrow } from '@/components/ui';
import type { Requisition } from '@asteai/types';
import styles from './requisitions.module.css';

const fetcher = (url: string) => api.get<Requisition[]>(url);

export default function RequisitionsPage() {
  const { data, isLoading, mutate } = useSWR('/requisitions', fetcher);

  const statusColor = (s: string) => {
    if (s === 'Open')   return 'mint';
    if (s === 'Paused') return 'amber';
    if (s === 'Filled') return 'gold';
    if (s === 'Draft')  return 'grey';
    return 'default';
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <Eyebrow>Hire & ATS</Eyebrow>
          <h1>Requisitions</h1>
        </div>
        <Button variant="primary">+ New Requisition</Button>
      </div>

      {isLoading && <Empty message="Loading…" />}

      {!isLoading && (!data || data.length === 0) && (
        <Empty message="No requisitions yet. Create your first one." />
      )}

      {data && data.length > 0 && (
        <div className={styles.grid}>
          {data.map((req) => (
            <Panel key={req.id} className={styles.card}>
              <div className={styles.cardTop}>
                <Tag color={statusColor(req.status) as any}>{req.status}</Tag>
                <span className={styles.dim}>{req.id}</span>
              </div>
              <h3 className={styles.title}>{req.title}</h3>
              <div className={styles.meta}>
                <span>{req.industry}</span>
                <span>·</span>
                <span>{req.tier}</span>
                <span>·</span>
                <span>{req.location}</span>
              </div>
              <div className={styles.weights}>
                <WeightBar label="IQ"   value={(req as any).weights?.iq ?? 33} />
                <WeightBar label="EQ"   value={(req as any).weights?.eq ?? 33} />
                <WeightBar label="Grit" value={(req as any).weights?.grit ?? 34} />
              </div>
              <div className={styles.footer}>
                <KPI value={req.headcount} label="Headcount" />
                <KPI value={req.minShortlist} label="Min shortlist" />
                <KPI value={req.threshold} label="Threshold" />
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}

function WeightBar({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.wRow}>
      <span className={styles.wLabel}>{label}</span>
      <div className={styles.wTrack}>
        <div className={styles.wFill} style={{ width: `${value}%` }} />
      </div>
      <span className={styles.wVal}>{value}</span>
    </div>
  );
}
