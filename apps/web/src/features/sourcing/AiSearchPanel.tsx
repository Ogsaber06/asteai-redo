'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import type { AiExpertSearchResponse, PublicCreditSettings, WalletView } from '@asteai/types';
import { ApiError, errorMessage, fetcher } from '@/lib/api';
import { Button, Panel, Tag } from '@/components/ui';
import { ExpertCardView } from '@/features/profiles/ExpertDirectory';
import { speechLocale } from '@/features/career/format';
import { isSpeechSupported, listenOnce, type Listening } from '@/features/voice-assistant/speech';
import { SOURCING_KEYS, sourcingApi } from './api';
import { AI_SEARCH_COST_FALLBACK, searchAffordability } from './format';
import styles from './Sourcing.module.css';

const LANGS = [['en', 'English'], ['hi', 'हिन्दी'], ['ta', 'தமிழ்'], ['te', 'తెలుగు'], ['kn', 'ಕನ್ನಡ'], ['bn', 'বাংলা']] as const;

/**
 * AI Expert Search + Voice Search. Shows the credit price and the balance before running,
 * and blocks the search (with a top-up link) when the wallet can't cover it.
 */
export function AiSearchPanel() {
  const { mutate } = useSWRConfig();
  const { data: wallet } = useSWR<WalletView>(SOURCING_KEYS.wallet, fetcher);
  const { data: costs } = useSWR<PublicCreditSettings>(SOURCING_KEYS.creditCosts, fetcher);
  const cost = costs?.costs.find((c) => c.feature === 'ai_search')?.cost ?? AI_SEARCH_COST_FALLBACK;
  const afford = searchAffordability(wallet?.balance, cost);

  const [query, setQuery] = useState('');
  const [lang, setLang] = useState('en');
  const [source, setSource] = useState<'text' | 'voice'>('text');
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; credits?: boolean } | null>(null);
  const [res, setRes] = useState<AiExpertSearchResponse | null>(null);
  const listen = useRef<Listening | null>(null);
  const [voiceOk, setVoiceOk] = useState(false);
  useEffect(() => setVoiceOk(isSpeechSupported()), []);
  useEffect(() => () => listen.current?.cancel(), []);

  async function run(q = query, from: 'text' | 'voice' = source) {
    if (q.trim().length < 3 || !afford.ok) return;
    setBusy(true);
    setError(null);
    try {
      const out = await sourcingApi.aiSearch({ query: q.trim(), source: from, ...(from === 'voice' ? { language: lang } : {}) });
      setRes(out);
      void mutate(SOURCING_KEYS.wallet);
    } catch (err) {
      setError({ text: errorMessage(err, 'Search failed; any credits taken were refunded.'), credits: err instanceof ApiError && err.status === 402 });
      void mutate(SOURCING_KEYS.wallet);
    } finally {
      setBusy(false);
    }
  }

  async function voice() {
    if (listening) { listen.current?.cancel(); setListening(false); return; }
    setError(null);
    setListening(true);
    listen.current = listenOnce(speechLocale(lang));
    try {
      const text = await listen.current.result;
      if (text) {
        setQuery(text);
        setSource('voice');
        await run(text, 'voice');
      }
    } catch (err) {
      setError({ text: err instanceof Error ? err.message : 'Voice search failed' });
    } finally {
      setListening(false);
    }
  }

  return (
    <Panel className={styles.stack}>
      <div className={styles.between}>
        <h2 className={styles.h2}>AI Expert Search</h2>
        <span className={afford.ok ? styles.cost : `${styles.cost} ${styles.costLow}`}>{afford.message}</span>
      </div>
      <form className={styles.searchBar} onSubmit={(e) => { e.preventDefault(); void run(); }}>
        <input
          className={styles.input}
          aria-label="Describe the expert you need"
          placeholder="e.g. Senior React dev with fintech experience, under ₹2,000/hour, available now"
          value={query}
          maxLength={1000}
          onChange={(e) => { setQuery(e.target.value); setSource('text'); }}
        />
        {voiceOk && (
          <button type="button" className={listening ? `${styles.mic} ${styles.micOn}` : styles.mic}
            aria-label={listening ? 'Stop listening' : 'Search by voice'} aria-pressed={listening} disabled={busy || !afford.ok} onClick={() => { void voice(); }}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          </button>
        )}
        <Button type="submit" variant="primary" disabled={busy || !afford.ok || query.trim().length < 3}>{busy ? 'Searching…' : 'Search'}</Button>
      </form>
      <div className={styles.row}>
        {voiceOk && (
          <label className={styles.row}>
            <span className={styles.muted}>Voice language</span>
            <select className={styles.select} style={{ width: 'auto', padding: '4px 8px' }} value={lang} onChange={(e) => setLang(e.target.value)}>
              {LANGS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>
          </label>
        )}
        {listening && <span className={styles.muted} aria-live="polite">Listening… say what you need.</span>}
      </div>
      {!afford.ok && <p className={styles.error}>Not enough credits for AI search. <Link href="/platform/wallet" className={styles.link}>Top up</Link></p>}
      {error && (
        <p className={styles.error} role="alert">{error.text}{error.credits && <> <Link href="/platform/wallet" className={styles.link}>Top up</Link></>}</p>
      )}

      {res && (
        <div className={styles.stack} aria-live="polite">
          <p className={styles.muted}>
            Understood: <strong>{res.intent.summary}</strong> · {res.results.length} of {res.considered} vetted experts · charged {res.credits.charged} credits, balance {res.credits.balance}
          </p>
          <div className={styles.chips}>
            {[...res.intent.skills, ...res.intent.domains].map((t) => <span key={t} className={styles.chip}>{t}</span>)}
            {res.intent.competencies.map((c) => <span key={c} className={styles.chip}>Passport: {c.replace(/_/g, ' ')}</span>)}
            {res.intent.maxHourlyRate !== null && <span className={styles.chip}>≤ {res.intent.maxHourlyRate} {res.intent.currency ?? ''}/h</span>}
            {res.intent.minYears !== null && <span className={styles.chip}>{res.intent.minYears}+ years</span>}
          </div>
          {res.results.length === 0 ? (
            <p className={styles.muted}>No vetted experts match yet. Try fewer requirements, or browse the directory below.</p>
          ) : (
            <ul className={styles.results}>
              {res.results.map((m) => (
                <li key={m.expert.userId} className={styles.result}>
                  <div className={styles.between}>
                    <span className={styles.fit}>{Math.round(m.score)}<span className={styles.muted}> fit</span></span>
                    {m.competencyScore !== null && <Tag color="mint">Passport {Math.round(m.competencyScore)}</Tag>}
                  </div>
                  <ExpertCardView expert={m.expert} />
                  {m.reasons.length > 0 && <ul className={styles.reasons}>{m.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Panel>
  );
}
