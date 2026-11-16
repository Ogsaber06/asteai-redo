'use client';

import useSWR from 'swr';
import type { Contract } from '@asteai/types';
import { fetcher } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Empty, PageHeader, Tag } from '@/components/ui';
import { ContractDetail, contractKey, STATUS_LABEL, statusColor } from '@/features/contracts';
import { DeliverableFiles } from '@/features/sourcing/Deliverables';
import { EscrowTracker } from '@/features/sourcing/EscrowTracker';

/**
 * One contract: the escrow milestone tracker (fund, submit, approve & release, dispute),
 * deliverable files and invoices on top; the full contract (signing, terms, cancellation)
 * below.
 */
export default function SourcingContractPage({ params }: { params: { id: string } }) {
  const id = decodeURIComponent(params.id);
  const userId = useAuthStore((s) => s.user?.id);
  const { data: contract, error, mutate } = useSWR<Contract>(contractKey(id), fetcher);
  if (error) return <Empty message="Could not load this contract." />;
  if (!contract) return <Empty message="Loading…" />;
  const isExpert = contract.expertId === userId;

  return (
    <>
      <PageHeader eyebrow="Escrow contract" title={contract.title} sub={<><span>{contract.id}</span> <Tag color={statusColor(contract.status)}>{STATUS_LABEL[contract.status]}</Tag></>} />
      <EscrowTracker contract={contract} onChanged={() => { void mutate(); }} />
      <DeliverableFiles contractId={contract.id} canUpload={isExpert && contract.status === 'active'} />
      <details>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Full contract: terms, signatures, history</summary>
        <div style={{ marginTop: 12 }}><ContractDetail id={id} /></div>
      </details>
    </>
  );
}
