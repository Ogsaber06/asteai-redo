'use client';

import { useEffect, useRef } from 'react';
import type { VoiceTarget } from '@asteai/types';

/** A target plus what to do when voice selects it (`value` is the text for fields). */
export interface RegisteredTarget extends VoiceTarget {
  run?: (value?: string) => boolean | void | Promise<boolean | void>;
}

const targets = new Map<string, RegisteredTarget>();
const elementIds = new WeakMap<HTMLElement, string>();
const maxDiscoveredControls = 100;
let nextElementId = 1;

/** Every explicit target and visible, labeled control the mounted page currently offers. */
export function pageTargets(knownRoutes: readonly VoiceTarget[] = []): RegisteredTarget[] {
  const registered = [...targets.values()];
  if (typeof document === 'undefined') return registered;

  const registeredLabels = new Set(registered.map((target) => `${target.kind}:${normalizeLabel(target.label)}`));
  const knownRoutePaths = new Set(knownRoutes
    .filter((target) => target.kind === 'route')
    .map((target) => `/platform/${target.id.slice('route:'.length)}`));
  const discovered: RegisteredTarget[] = [];
  const controls = document.querySelectorAll<HTMLElement>(
    'button, a[href], input:not([type="hidden"]), textarea, select, summary, [role="button"], [role="link"], [role="checkbox"], [role="switch"], [role="radio"], [role="tab"], [role="option"], [role="menuitem"]',
  );

  for (const element of controls) {
    if (discovered.length >= maxDiscoveredControls) break;
    if (!isAvailable(element) || element.closest('[data-testid="voice-assistant-dock"]')) continue;

    const label = accessibleName(element);
    if (!label) continue;

    const field = isVoiceField(element);
    const link = element instanceof HTMLAnchorElement || element.getAttribute('role') === 'link';
    const action = isVoiceAction(element);
    if (!field && !action) continue;
    if (field && isSensitiveField(element, label)) continue;
    if (link && !isSafeInternalLink(element)) continue;

    const kind = field ? 'field' : 'action';
    if (registeredLabels.has(`${kind}:${normalizeLabel(label)}`)) continue;
    const href = element.getAttribute('href');
    if (link && href && knownRoutePaths.has(new URL(href, window.location.href).pathname)) continue;

    const target: RegisteredTarget = {
      id: elementId(element),
      kind,
      label,
      description: field ? fieldDescription(element) : link ? 'Visible link on this page.' : 'Visible page button.',
      // Generic buttons can trigger a write, payment, publication, or deletion.
      // Ask before clicking; same-origin links only navigate and need no confirmation.
      confirm: action && !link,
      run: (value) => {
        if (!isAvailable(element)) return false;
        if (field) return setVoiceField(element, value ?? '');
        element.click();
        return true;
      },
    };
    discovered.push(target);
  }

  return [...registered, ...discovered];
}

/**
 * Registers page-specific actions and fields while the component is mounted.
 * Explicit targets can provide more precise behavior than generic DOM discovery.
 */
export function useVoiceTargets(list: RegisteredTarget[]) {
  const latest = useRef(list);
  latest.current = list;
  const key = list.map((t) => `${t.id}|${t.label}|${t.confirm ? 1 : 0}`).join(',');

  useEffect(() => {
    const ids = latest.current.map((t) => t.id);
    latest.current.forEach((t) =>
      targets.set(t.id, { ...t, run: (value) => {
        const current = latest.current.find((x) => x.id === t.id);
        return current?.run ? current.run(value) : false;
      } }),
    );
    return () => ids.forEach((id) => targets.delete(id));
  }, [key]);
}

function elementId(element: HTMLElement): string {
  let id = elementIds.get(element);
  if (!id) {
    id = `dom:control-${nextElementId++}`;
    elementIds.set(element, id);
  }
  return id;
}

function isAvailable(element: HTMLElement): boolean {
  if (!element.isConnected || element.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
  const state = element as HTMLElement & { disabled?: boolean; readOnly?: boolean };
  return element.getClientRects().length > 0 && !state.disabled && !state.readOnly && element.getAttribute('aria-disabled') !== 'true';
}

function accessibleName(element: HTMLElement): string {
  const labelledBy = element.getAttribute('aria-labelledby')?.split(/\s+/)
    .map((id) => document.getElementById(id)?.innerText ?? '')
    .join(' ');
  const inputLabels = element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement
    ? Array.from(element.labels ?? []).map((label) => label.innerText).join(' ')
    : '';
  const name = element.getAttribute('aria-label') || labelledBy || inputLabels ||
    element.getAttribute('title') || element.getAttribute('placeholder') ||
    ((element instanceof HTMLInputElement && ['button', 'submit', 'reset'].includes(element.type)) ? element.value : '') ||
    element.innerText;
  return (name ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

function isVoiceField(element: HTMLElement): boolean {
  if (['checkbox', 'switch'].includes(element.getAttribute('role') ?? '')) return true;
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return true;
  if (!(element instanceof HTMLInputElement)) return false;
  return ['text', 'email', 'tel', 'search', 'url', 'number', 'range', 'date', 'time', 'month', 'week', 'checkbox', 'radio'].includes(element.type);
}

function isVoiceAction(element: HTMLElement): boolean {
  if (element instanceof HTMLAnchorElement) return true;
  if (element instanceof HTMLButtonElement || element instanceof HTMLElement && element.tagName === 'SUMMARY') return true;
  if (['button', 'link', 'radio', 'tab', 'option', 'menuitem'].includes(element.getAttribute('role') ?? '')) return true;
  return element instanceof HTMLInputElement && ['button', 'submit', 'reset'].includes(element.type);
}

function isSafeInternalLink(element: HTMLElement): boolean {
  if ((element instanceof HTMLAnchorElement && element.target && element.target !== '_self') || element.hasAttribute('download')) return false;
  const href = element.getAttribute('href');
  if (!href) return false;
  try {
    return new URL(href, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

function isSensitiveField(element: HTMLElement, label: string): boolean {
  if (element instanceof HTMLInputElement && element.type === 'password') return true;
  const details = [label, element.getAttribute('name'), element.getAttribute('id'), element.getAttribute('autocomplete')]
    .filter(Boolean).join(' ');
  return /password|passcode|one[ -]?time|verification code|\botp\b|\bpin\b|cvv|security code|card number|credit card|debit card|\bcc[-_ ]?(?:number|csc|exp|name)\b|bank account|account number|routing number|\bifsc\b|\bupi\b|aadhaar|aadhar|\bpan\b|tax id|tax number|social security|\bssn\b|national id|government id|passport number|driver.?s? license|date of birth|\bdob\b|api key|secret|access token/i.test(details);
}

function fieldDescription(element: HTMLElement): string {
  if (element instanceof HTMLInputElement && element.type === 'checkbox' || ['checkbox', 'switch'].includes(element.getAttribute('role') ?? '')) {
    const checked = element instanceof HTMLInputElement ? element.checked : element.getAttribute('aria-checked') === 'true';
    return `Checkbox; currently ${checked ? 'checked' : 'unchecked'}.`;
  }
  if (element instanceof HTMLInputElement && element.type === 'radio') return 'Radio option.';
  if (element instanceof HTMLSelectElement) return 'Choose one of the listed options.';
  return 'Fill the visible form field.';
}

function setVoiceField(element: HTMLElement, value: string): boolean {
  if (['checkbox', 'switch'].includes(element.getAttribute('role') ?? '')) {
    const desired = /^(?:true|yes|on|checked|check|selected|select|enabled|enable)$/i.test(value.trim());
    const unchecked = /^(?:false|no|off|unchecked|uncheck|deselected|deselect|disabled|disable)$/i.test(value.trim());
    if (!desired && !unchecked) return false;
    const checked = element.getAttribute('aria-checked') === 'true';
    if (checked !== desired) element.click();
    return (element.getAttribute('aria-checked') === 'true') === desired;
  }

  if (element instanceof HTMLInputElement && ['checkbox', 'radio'].includes(element.type)) {
    const desired = /^(?:true|yes|on|checked|check|selected|select|enabled|enable)$/i.test(value.trim());
    const unchecked = /^(?:false|no|off|unchecked|uncheck|deselected|deselect|disabled|disable)$/i.test(value.trim());
    if (!desired && !unchecked || element.type === 'radio' && unchecked) return false;
    if (element.checked !== desired) element.click();
    return element.checked === desired;
  }

  if (element instanceof HTMLSelectElement) {
    const wanted = normalizeLabel(value);
    const option = Array.from(element.options).find((item) =>
      normalizeLabel(item.label) === wanted || normalizeLabel(item.value) === wanted,
    );
    if (!option) return false;
    setNativeValue(element, option.value);
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return element.value === option.value;
  }

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    setNativeValue(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return element.value === value;
  }
  return false;
}

function setNativeValue(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')?.set;
  if (setter) setter.call(element, value);
  else element.value = value;
}

function normalizeLabel(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}
