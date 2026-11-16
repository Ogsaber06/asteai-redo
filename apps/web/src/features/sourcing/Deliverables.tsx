'use client';

import { useRef, useState } from 'react';
import useSWR from 'swr';
import type { DeliverableFile, GigOrder } from '@asteai/types';
import { errorMessage, fetcher } from '@/lib/api';
import { Button, Empty, Panel } from '@/components/ui';
import { SOURCING_KEYS, putFile, sourcingApi } from './api';
import { checkDeliverableFile, formatBytes, orderWorkLog } from './format';
import styles from './Sourcing.module.css';

/**
 * Deliverable files for an order or a contract milestone. The expert uploads (straight to
 * storage); both sides download through the API, which checks they're a party.
 */
export function DeliverableFiles({ orderId, contractId, milestoneId, canUpload, title = 'Deliverable files' }: {
  orderId?: string;
  contractId?: string;
  milestoneId?: string;
  canUpload: boolean;
  title?: string;
}) {
  const key = SOURCING_KEYS.files({ orderId, contractId });
  const { data: files, error, mutate } = useSWR<DeliverableFile[]>(key, fetcher);
  const [progress, setProgress] = useState<{ name: string; f: number } | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const shown = (files ?? []).filter((f) => !milestoneId || f.milestoneId === milestoneId || f.milestoneId === null);

  async function upload(list: FileList | null) {
    if (!list?.length) return;
    setMessage(null);
    let done = 0;
    for (const file of Array.from(list).slice(0, 10)) {
      const ok = checkDeliverableFile(file);
      if ('error' in ok) { setMessage({ ok: false, text: `${file.name}: ${ok.error}` }); continue; }
      try {
        setProgress({ name: file.name, f: 0 });
        const ticket = await sourcingApi.uploadUrl({ orderId, contractId: orderId ? undefined : contractId, milestoneId, fileName: file.name, contentType: ok.contentType, sizeBytes: file.size });
        await putFile(ticket, file, (f) => setProgress({ name: file.name, f }));
        done++;
      } catch (err) {
        setMessage({ ok: false, text: `${file.name}: ${errorMessage(err, 'upload failed')}` });
      }
    }
    setProgress(null);
    if (input.current) input.current.value = '';
    if (done) {
      setMessage({ ok: true, text: `Uploaded ${done} file${done === 1 ? '' : 's'}. Mention them in your delivery note when you deliver.` });
      void mutate();
    }
  }

  return (
    <Panel className={styles.stack}>
      <h2 className={styles.h2}>{title}</h2>
      {canUpload && (
        <div
          className={drag ? `${styles.drop} ${styles.dropActive}` : styles.drop}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); void upload(e.dataTransfer.files); }}
        >
          <span>Drop files here, or</span>
          <input ref={input} type="file" multiple style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} aria-label="Choose deliverable files"
            onChange={(e) => { void upload(e.target.files); }} />
          <Button disabled={progress !== null} onClick={() => input.current?.click()}>Choose files</Button>
          <span className={styles.muted}>PDF, ZIP, images, Office, text or MP4 · up to 50 MB each</span>
        </div>
      )}
      {progress && (
        <div className={styles.stack} style={{ gap: 4 }}>
          <span className={styles.muted}>Uploading {progress.name}…</span>
          <div className={styles.progress} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.f * 100)}>
            <span style={{ width: `${Math.round(progress.f * 100)}%` }} />
          </div>
        </div>
      )}
      {message && <p className={message.ok ? styles.ok : styles.error} role={message.ok ? 'status' : 'alert'}>{message.text}</p>}
      {error ? <Empty message="Could not load files." /> : !files ? <Empty message="Loading…" /> : !shown.length ? (
        <p className={styles.muted}>{canUpload ? 'No files uploaded yet.' : 'The expert has not uploaded files yet.'}</p>
      ) : (
        <ul className={styles.files}>
          {shown.map((f) => (
            <li key={f.id} className={styles.file}>
              <span>{f.fileName} <span className={styles.muted}>· {formatBytes(f.sizeBytes)} · {new Date(f.createdAt).toLocaleString()}</span></span>
              <a href={f.downloadPath} className={styles.link} download>Download</a>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** Everything that happened on an order, oldest first. */
export function WorkLog({ order }: { order: GigOrder }) {
  const { data: files } = useSWR<DeliverableFile[]>(order.contractId ? SOURCING_KEYS.files({ orderId: order.id }) : null, fetcher);
  const log = orderWorkLog(order, files ?? []);
  return (
    <Panel className={styles.stack}>
      <h2 className={styles.h2}>Work log</h2>
      <ol className={styles.log}>
        {log.map((e, i) => (
          <li key={`${e.at}-${i}`}>
            <strong>{e.label}</strong>
            <span className={styles.muted}>{new Date(e.at).toLocaleString()}</span>
            {e.detail && <p className={styles.logDetail}>{e.detail}</p>}
          </li>
        ))}
      </ol>
    </Panel>
  );
}
