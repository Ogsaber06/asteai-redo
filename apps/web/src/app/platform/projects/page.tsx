'use client';

import useSWR from 'swr';
import type { MilestoneStatus, Project, ProjectStage } from '@asteai/types';
import { fetcher } from '@/lib/api';
import { Empty, Eyebrow, KPI, Panel, Tag, type TagColor } from '@/components/ui';
import styles from './projects.module.css';

const STAGE_COLOR: Partial<Record<ProjectStage | MilestoneStatus, TagColor>> = {
  'Open for Bids': 'gold',
  Contracted: 'amber',
  'In Progress': 'default',
  Completed: 'mint',
  Disputed: 'rose',
  Released: 'mint',
  Funded: 'gold',
};

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export default function ProjectsPage() {
  const { data, error, isLoading } = useSWR<Project[]>('/projects/mine', fetcher);

  return (
    <div className={styles.page}>
      <Eyebrow>Buyer</Eyebrow>
      <h1>My Projects</h1>

      {isLoading && <Empty message="Loading…" />}
      {error && <Empty message={error.message} />}
      {data && data.length === 0 && <Empty message="No projects yet." />}

      {data?.map((p) => (
        <Panel key={p.id} className={styles.card}>
          <div className={styles.header}>
            <h3>{p.title}</h3>
            <Tag color={STAGE_COLOR[p.stage] ?? 'default'}>{p.stage}</Tag>
          </div>
          <p className={styles.desc}>{p.description}</p>
          <div className={styles.milestones}>
            {p.milestones.map((m) => (
              <div key={m.id} className={styles.milestone}>
                <span>{m.name}</span>
                <span className={styles.mAmt}>{inr(m.amount)}</span>
                <Tag color={STAGE_COLOR[m.status] ?? 'grey'}>{m.status}</Tag>
              </div>
            ))}
          </div>
          <div className={styles.footer}>
            <KPI value={inr(p.budget)} label="Budget" />
            <KPI value={p.proposals.length} label="Proposals" />
          </div>
        </Panel>
      ))}
    </div>
  );
}
