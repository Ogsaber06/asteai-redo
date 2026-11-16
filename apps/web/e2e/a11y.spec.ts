import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Public pages, light and dark (one Playwright project each):
 *  - zero critical / serious axe violations (WCAG 2.0/2.1 A + AA: contrast, ARIA, names, …)
 *  - zero Content-Security-Policy violations (scripts, styles, frames, connections)
 */
const PAGES = ['/', '/for-companies', '/pricing', '/jobs', '/auth/login'] as const;

declare global {
  interface Window { __csp: { directive: string; blocked: string; source: string }[] }
}

async function prepare(page: Page, theme: 'light' | 'dark') {
  // Record CSP violations from the very first script, and pin the theme the init script reads.
  await page.addInitScript((t) => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__csp.push({ directive: e.violatedDirective, blocked: e.blockedURI, source: `${e.sourceFile}:${e.lineNumber}` });
    });
    try { localStorage.setItem('asteai-theme', t); } catch { /* ignore */ }
  }, theme);
}

for (const path of PAGES) {
  test(`${path}: no critical/serious accessibility issues, no CSP violations`, async ({ page }, info) => {
    const theme = info.project.name as 'light' | 'dark';
    const consoleCsp: string[] = [];
    page.on('console', (m) => { if (/Content Security Policy/i.test(m.text())) consoleCsp.push(m.text()); });
    await prepare(page, theme);

    const res = await page.goto(path, { waitUntil: 'load' });
    // Best effort: third-party widgets (e.g. Turnstile on lead forms) may never go fully idle.
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
    expect(res?.status(), `${path} should load`).toBeLessThan(400);
    expect(res?.headers()['content-security-policy'], 'CSP header present').toBeTruthy();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    // Let fonts and any entrance transitions settle before measuring contrast.
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const blocking = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    const report = blocking.map((v) =>
      `[${v.impact}] ${v.id}: ${v.help}\n${v.nodes.slice(0, 5).map((n) => `   ${n.target.join(' ')}\n     ${n.failureSummary?.split('\n').slice(1, 3).join(' ')}`).join('\n')}`,
    ).join('\n');
    expect(blocking, `${path} (${theme}) axe violations:\n${report}`).toEqual([]);

    const csp = await page.evaluate(() => window.__csp);
    expect([...csp.map((v) => `${v.directive} blocked ${v.blocked} (${v.source})`), ...consoleCsp], `${path} (${theme}) CSP violations`).toEqual([]);
  });
}
