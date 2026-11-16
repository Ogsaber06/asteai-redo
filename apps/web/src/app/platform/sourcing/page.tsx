'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { Empty, PageHeader } from '@/components/ui';
import { ExpertCardView, ExpertFiltersForm, Pager } from '@/features/profiles/ExpertDirectory';
import { filtersToQuery, parseFilters } from '@/features/profiles/format';
import type { ExpertPage } from '@/features/profiles/types';
import profiles from '@/features/profiles/profiles.module.css';
import { AiSearchPanel } from '@/features/sourcing/AiSearchPanel';

const BASE_PATH = '/platform/sourcing';
const PAGE_SIZE = 12;

/** Find Top Experts: AI / voice search (metered) on top of the free, filterable directory. */
export default function FindExpertsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const filters = parseFilters(searchParams);
  const query = filtersToQuery(filters);
  const { data, error, isLoading } = useSWR<ExpertPage>(`/experts${query ? `${query}&` : '?'}pageSize=${PAGE_SIZE}`, fetcher, { keepPreviousData: true });

  return (
    <>
      <PageHeader
        eyebrow="Talent Sourcing"
        title="Find top experts"
        sub="Describe what you need (or say it) and AI ranks vetted experts by verified Passport skills and domain fit. The directory filters below are free."
      />
      <AiSearchPanel />
      <div className={profiles.directory} style={{ paddingBlock: 0 }}>
        <ExpertFiltersForm key={query} filters={filters} basePath={BASE_PATH} />
        <section aria-labelledby="dir-h">
          <div className={profiles.resultsHead}>
            <h2 id="dir-h" className={profiles.muted} aria-live="polite">
              {data ? `${data.total} expert${data.total === 1 ? '' : 's'} in the directory` : 'Directory'}
            </h2>
          </div>
          {isLoading && !data && <Empty message="Loading experts…" />}
          {error && <div className={profiles.emptyBox} role="alert">Could not load the directory.</div>}
          {data && data.items.length === 0 && <div className={profiles.emptyBox}>No experts match these filters.</div>}
          {data && data.items.length > 0 && (
            <>
              <ul className={profiles.cards}>{data.items.map((e) => <li key={e.userId}><ExpertCardView expert={e} /></li>)}</ul>
              <Pager filters={filters} page={data.page} pageSize={data.pageSize} total={data.total} basePath={BASE_PATH} />
            </>
          )}
        </section>
      </div>
    </>
  );
}
