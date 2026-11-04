'use client';

import useSWR from 'swr';
import type { ReqStatus, Requisition } from '@asteai/types';
import { fetcher } from '@/lib/api';
import { Button, Empty, Eyebrow, KPI, Panel, Tag, type TagColor } from '@/components/ui';
import styles from './requisitions.module.css';

const STATUS_COLOR: Record<ReqStatus, TagColor> = {
  Open: 'mint',
  Paused: 'amber',
  Filled: 'gold',
  Draft: 'grey',
  Closed: 'default',
};

export default function RequisitionsPage() {
  const { data, error, isLoading } = useSWR<Requisition[]>('/requisitions', fetcher);

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
      {error && <Empty message={error.message} />}
      {data && data.length === 0 && <Empty message="No requisitions yet. Create your first one." />}

      {data && data.length > 0 && (
        <div className={styles.grid}>
          {data.map((req) => <RequisitionCard key={req.id} req={req} />)}
        </div>
      )}
    </div>
  );
}

function RequisitionCard({ req }: { req: Requisition }) {
  return (
    <Panel className={styles.card}>
      <div className={styles.cardTop}>
        <Tag color={STATUS_COLOR[req.status] ?? 'default'}>{req.status}</Tag>
        <span className={styles.dim}>{req.id}</span>
      </div>
      <h3 className={styles.title}>{req.title}</h3>
      <div className={styles.meta}>
        {[req.industry, req.tier, req.location].filter(Boolean).join(' · ')}
      </div>
      <div className={styles.weights}>
        <WeightBar label="IQ" value={req.weights.iq} />
        <WeightBar label="EQ" value={req.weights.eq} />
        <WeightBar label="Grit" value={req.weights.grit} />
      </div>
      <div className={styles.footer}>
        <KPI value={req.headcount} label="Headcount" />
        <KPI value={req.minShortlist} label="Min shortlist" />
        <KPI value={req.threshold} label="Threshold" />
      </div>
    </Panel>
  );
}

function WeightBar({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.wRow}>
      <span className={styles.wLabel}>{label}</span>
      <div className={styles.wTrack}>
        <div className={styles.wFill} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
      <span className={styles.wVal}>{value}</span>
    </div>
  );
}
