'use client';

import useSWR from 'swr';
import { api } from '@/lib/api';
import { Panel, KPI, Eyebrow, Tag } from '@/components/ui';
import styles from './admin.module.css';

export default function AdminPage() {
  const { data, isLoading } = useSWR('/admin/stats', (u) => api.get<any>(u));

  if (isLoading) return <p>Loading…</p>;

  return (
    <div className={styles.page}>
      <Eyebrow>Admin</Eyebrow>
      <h1>Master Control</h1>

      <div className={styles.kpis}>
        <Panel><KPI value={data?.totalTenants ?? '—'} label="Tenants" /></Panel>
        {(data?.usersByRole ?? []).map((r: any) => (
          <Panel key={r.role}><KPI value={r.count} label={r.role} /></Panel>
        ))}
      </div>

      <div className={styles.grids}>
        <Panel>
          <Eyebrow>Requisitions by status</Eyebrow>
          <table className={styles.table}>
            <tbody>
              {(data?.reqs ?? []).map((r: any) => (
                <tr key={r.status}>
                  <td><Tag>{r.status}</Tag></td>
                  <td>{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel>
          <Eyebrow>Applications by stage</Eyebrow>
          <table className={styles.table}>
            <tbody>
              {(data?.applications ?? []).map((a: any) => (
                <tr key={a.stage}>
                  <td>{a.stage}</td>
                  <td>{a.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </div>
  );
}
