'use client';

import useSWR from 'swr';
import type { GigOrder } from '@asteai/types';
import { fetcher } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { OrderDetail, orderKey } from '@/features/gigs';
import { DeliverableFiles, WorkLog } from '@/features/sourcing/Deliverables';

const ROUTES = { orders: '/platform/sourcing/orders', contracts: '/platform/sourcing/contracts' };

/** One order: status, delivery and review actions, deliverable files and the work log. */
export default function SourcingOrderPage({ params }: { params: { id: string } }) {
  const id = decodeURIComponent(params.id);
  const userId = useAuthStore((s) => s.user?.id);
  const { data: order } = useSWR<GigOrder>(orderKey(id), fetcher);
  const isExpert = !!order && order.expertId === userId;
  const working = !!order && ['in_progress', 'revision_requested', 'delivered'].includes(order.status);

  return (
    <OrderDetail id={id} routes={ROUTES}>
      {order?.contractId && <DeliverableFiles orderId={order.id} canUpload={isExpert && working} />}
      {order && <WorkLog order={order} />}
    </OrderDetail>
  );
}
