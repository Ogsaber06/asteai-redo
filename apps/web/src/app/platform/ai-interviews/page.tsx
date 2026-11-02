'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { Tag, Empty, PageHeader, Chips } from '@/components/ui';
import { statusTag, toNumber, type InterviewStatus } from '@/lib/interviews';
import styles from '../studio/studio.module.css';

interface AdminRow {
  id: string;
  email: string;
  candidate_name: string;
  category: string;
  skill: string;
  domain: string;
  status: InterviewStatus;
  turns: number;
  started_at: string;
  overall_score: string | null;
  eq_score: string | null;
  resilience_score: string | null;
  grit_score: string | null;
}

type Filter = 'all' | InterviewStatus;
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'completed', label: 'Completed' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'abandoned', label: 'Not finished' },
];

const show = (v: string | null) => {
  const x = toNumber(v);
  return x === null ? '—' : String(x);
};

export default function AdminInterviewsPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const { data, isLoading, error } = useSWR(['/interviews/admin/mock', filter], () =>
    api.get<AdminRow[]>('/interviews/admin/mock', { status: filter === 'all' ? undefined : filter, limit: 100 }),
  );

  return (
    <div className={styles.page}>
      <PageHeader eyebrow="Master Control" title="AI Interviews" sub="Mock interviews across the platform, with Part 1 scores." />
      <Chips label="Status" options={FILTERS} value={filter} onChange={setFilter} />
      {error && <Empty message={error.message} />}
      {isLoading && <Empty message="Loading…" />}
      {data && data.length === 0 && <Empty message="No interviews." />}
      <div className={styles.list}>
        {data?.map((r) => {
          const tag = statusTag(r.status);
          const overall = toNumber(r.overall_score);
          return (
            <Link key={r.id} href={`/platform/studio/${r.id}`} className={styles.item}>
              <div>
                <div className={styles.itemTitle}>{r.candidate_name || r.email} · {r.skill}</div>
                <div className={`${styles.small} ${styles.dim}`}>
                  {r.category} · {r.domain.replace(' (Frontline)', '')} ·{' '}
                  {new Date(r.started_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} · {r.turns} turns
                </div>
                <div className={`${styles.small} ${styles.dim}`}>
                  EQ {show(r.eq_score)} · Resilience {show(r.resilience_score)} · Grit {show(r.grit_score)}
                </div>
              </div>
              <div className={styles.row}>
                {overall !== null && <span className={styles.score}>{Math.round(overall)}</span>}
                <Tag color={tag.color}>{tag.label}</Tag>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
