'use client';

import { Catalogue } from '@/features/gigs';

const ROUTES = { orders: '/platform/sourcing/orders', contracts: '/platform/sourcing/contracts' };

/** Pre-packaged services: catalogue cards and the order flow (package → requirements → terms → pay). */
export default function SourcingServicesPage() {
  return <Catalogue routes={ROUTES} />;
}
