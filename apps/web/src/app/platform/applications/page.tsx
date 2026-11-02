'use client';

import useSWR from 'swr';
import { api } from '@/lib/api';
import { Panel, Tag, Empty, Eyebrow } from '@/components/ui';
import type { Application } from '@asteai/types';
import styles from './applications.module.css';

const STAGE_COLOR: Record<string, 'default' | 'gold' | 'mint' | 'rose' | 'amber' | 'grey'> = {
  'Applied':              'grey',
  'Eligibility':          'grey',
  'Assessment Pending':   'amber',
  'Assessment Review':    'amber',
  'Shortlisted':          'gold',
  'Interview':            'gold',
  'Offer':                'mint',
  'Joined':               'mint',
  'Rejected':             'rose',
};

export default function ApplicationsPage() {
  const { data, isLoading } = useSWR('/applications/me', (url) =>
    api.get<Application[]>(url),
  );

  return (
    <div className={styles.page}>
      <Eyebrow>Candidate</Eyebrow>
      <h1>My Applications</h1>

      {isLoading && <Empty message="Loading…" />}
      {!isLoading && (!data || data.length === 0) && (
        <Empty message="You haven't applied to any roles yet." />
      )}

      {data && (
        <div className={styles.list}>
          {data.map((app) => (
            <Panel key={app.id} className={styles.row}>
              <div className={styles.left}>
                <div className={styles.reqTitle}>{(app as any).req_title ?? app.requisitionId}</div>
                <div className={styles.meta}>{(app as any).industry} · {(app as any).tier}</div>
              </div>
              <Tag color={STAGE_COLOR[app.stage] ?? 'grey'}>{app.stage}</Tag>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
