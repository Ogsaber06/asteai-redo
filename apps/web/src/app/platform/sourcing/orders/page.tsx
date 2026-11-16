'use client';

import { OrdersList } from '@/features/gigs';

const ROUTES = { orders: '/platform/sourcing/orders', contracts: '/platform/sourcing/contracts' };

/** Active orders for both sides (buyer: placed; expert: to fulfil). */
export default function SourcingOrdersPage() {
  return <OrdersList routes={ROUTES} />;
}
