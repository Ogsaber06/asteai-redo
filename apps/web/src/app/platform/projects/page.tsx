'use client';

import useSWR from 'swr';
import { api } from '@/lib/api';
import { Panel, Tag, KPI, Eyebrow, Empty } from '@/components/ui';
import type { Project } from '@asteai/types';
import styles from './projects.module.css';

const STAGE_COLOR: Record<string, any> = {
  'Open for Bids': 'gold',
  'Contracted':    'amber',
  'In Progress':   'default',
  'Completed':     'mint',
  'Disputed':      'rose',
};

export default function ProjectsPage() {
  const { data, isLoading } = useSWR('/projects/mine', (u) => api.get<Project[]>(u));

  return (
    <div className={styles.page}>
      <Eyebrow>Buyer</Eyebrow>
      <h1>My Projects</h1>

      {isLoading && <Empty message="Loading…" />}

      {data && data.length === 0 && <Empty message="No projects yet." />}

      {data && data.map((p) => (
        <Panel key={p.id} className={styles.card}>
          <div className={styles.header}>
            <h3>{p.title}</h3>
            <Tag color={STAGE_COLOR[p.stage]}>{p.stage}</Tag>
          </div>
          <p className={styles.desc}>{p.description}</p>
          <div className={styles.milestones}>
            {(p.milestones ?? []).map((m) => (
              <div key={m.id} className={styles.milestone}>
                <span>{m.name}</span>
                <span className={styles.mAmt}>₹{m.amount?.toLocaleString('en-IN')}</span>
                <Tag color={STAGE_COLOR[m.status] ?? 'grey'}>{m.status}</Tag>
              </div>
            ))}
          </div>
          <div className={styles.footer}>
            <KPI value={`₹${(p.budget ?? 0).toLocaleString('en-IN')}`} label="Budget" />
            <KPI value={p.proposals?.length ?? 0} label="Proposals" />
          </div>
        </Panel>
      ))}
    </div>
  );
}
