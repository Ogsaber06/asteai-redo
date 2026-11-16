import { expect, test, type Page } from '@playwright/test';

declare global {
  interface Window {
    __voiceTranscript: string;
    __spoken: { text: string; name?: string; lang: string }[];
    __audioPlayed: boolean;
    __neuralRequests: { text: string; language: string }[];
    __assistantRequests: number;
  }
}

async function signInAsEmployer(page: Page) {
  await page.context().addCookies([{ name: 'asteai_session', value: 'e2e', domain: 'localhost', path: '/' }]);
  await page.addInitScript(() => {
    const user = {
      id: 'e2e-employer', email: 'employer@example.test', firstName: 'Demo', lastName: 'Employer', role: 'Employer',
      tenantId: 'e2e-tenant', accountStatus: 'active', emailVerified: true,
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    };
    localStorage.setItem('asteai-auth', JSON.stringify({ state: { user, sessionId: 'e2e-session' }, version: 0 }));
    window.__voiceTranscript = 'What can you do?';
    window.__spoken = [];
    window.__audioPlayed = false;
    window.__neuralRequests = [];
    window.__assistantRequests = 0;

    class FakeRecognition {
      lang = 'en-IN';
      interimResults = false;
      maxAlternatives = 1;
      onresult: ((event: { results: Array<{ 0: { transcript: string } }> }) => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        queueMicrotask(() => {
          this.onresult?.({ results: [{ 0: { transcript: window.__voiceTranscript } }] });
          this.onend?.();
        });
      }
      abort() { this.onend?.(); }
    }
    Object.defineProperty(window, 'SpeechRecognition', { value: FakeRecognition, configurable: true });

    const voices = [{ name: 'Microsoft Aria Online (Natural)', lang: 'en-IN', default: true }];
    class FakeUtterance {
      lang = '';
      voice: SpeechSynthesisVoice | null = null;
      constructor(readonly text: string) {}
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: FakeUtterance, configurable: true });
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        getVoices: () => voices,
        speak: (utterance: SpeechSynthesisUtterance) => window.__spoken.push({
          text: utterance.text, name: utterance.voice?.name, lang: utterance.lang,
        }),
        cancel: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      },
    });
    Object.defineProperty(window, 'Audio', {
      configurable: true,
      value: class extends EventTarget {
        src: string;
        constructor(src: string) { super(); this.src = src; }
        async play() {
          window.__audioPlayed = true;
          this.dispatchEvent(new Event('ended'));
        }
        pause() { /* test audio has no active playback */ }
      },
    });
  });
}

async function mockAssistantApi(page: Page, speechStatus = true) {
  await page.route('**/api/v1/**', (route) => route.fulfill({ status: 200, json: { data: [] } }));
  await page.route('**/api/v1/analytics/employer/hiring-kpis', (route) => route.fulfill({
    status: 200,
    json: { data: {
      openRequisitions: 0, pendingApproval: 0, activeCampaigns: 0, timeToHireDays: null,
      hiresLast180Days: 0, matchRatePct: null, reviewedLast90Days: 0, byStage: {},
    } },
  }));
  await page.route('**/api/v1/voice/synthesis/status', (route) => route.fulfill({
    status: 200, json: { data: { enabled: speechStatus } },
  }));
  await page.route('**/api/v1/assistant/command', async (route) => {
    await page.evaluate(() => window.__assistantRequests++);
    await route.fulfill({
    status: 200,
    json: { data: { kind: 'answer', targetId: null, value: null, needsConfirmation: false, speech: 'Here is a quick overview.' } },
    });
  });
}

test('supported help is spoken naturally; short replies fit a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await signInAsEmployer(page);
  await mockAssistantApi(page);
  await page.route('**/api/v1/voice/synthesize', async (route) => {
    const request = route.request().postDataJSON() as { text: string; language: string };
    await page.evaluate((body) => window.__neuralRequests.push(body), request);
    await route.fulfill({ status: 200, contentType: 'audio/mpeg', body: Buffer.from([0x49, 0x44, 0x33]) });
  });

  await page.goto('/platform/hire');
  await expect(page.getByRole('button', { name: 'Use on-device voice' })).toBeVisible();
  await page.getByRole('button', { name: 'Voice command (Alt+V)' }).click();
  await expect(page.getByText(/I can open sections available to your role/)).toBeVisible();
  await expect(page.getByText('Natural voice', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__audioPlayed)).toBe(true);
  expect(await page.evaluate(() => window.__neuralRequests.map((r) => r.text))).toEqual([
    'I can open sections available to your role, fill labeled fields, and trigger visible controls. I will ask you to confirm before pressing a button that may change data.',
  ]);

  const dock = await page.getByTestId('voice-assistant-dock').boundingBox();
  expect(dock).not.toBeNull();
  expect(dock!.x).toBeGreaterThanOrEqual(0);
  expect(dock!.x + dock!.width).toBeLessThanOrEqual(360);
});

test('device voice speaks when neural speech fails', async ({ page }) => {
  await signInAsEmployer(page);
  await mockAssistantApi(page);
  await page.route('**/api/v1/voice/synthesize', (route) => route.fulfill({
    status: 503, contentType: 'application/json', json: { message: 'Neural speech unavailable' },
  }));

  await page.goto('/platform/hire');
  await expect(page.getByRole('button', { name: 'Use on-device voice' })).toBeVisible();
  await page.getByRole('button', { name: 'Voice command (Alt+V)' }).click();
  await expect(page.getByText(/I can open sections available to your role/)).toBeVisible();
  await expect(page.getByText('On-device voice', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__spoken.length)).toBe(1);
  expect(await page.evaluate(() => window.__spoken[0])).toEqual({
    text: 'I can open sections available to your role, fill labeled fields, and trigger visible controls. I will ask you to confirm before pressing a button that may change data.',
    name: 'Microsoft Aria Online (Natural)', lang: 'en-IN',
  });
});

test('discovers visible buttons and confirms them before triggering page actions', async ({ page }) => {
  await signInAsEmployer(page);
  await mockAssistantApi(page);
  await page.goto('/platform/hire');
  await page.evaluate(() => {
    const button = document.createElement('button');
    button.textContent = 'Delete demo record';
    button.dataset.demoDeleted = 'false';
    button.style.minHeight = '40px';
    button.addEventListener('click', () => { button.dataset.demoDeleted = 'true'; });
    document.querySelector('main')?.append(button);
  });
  await page.route('**/api/v1/assistant/command', async (route) => {
    const body = route.request().postDataJSON() as { targets: { id: string; label: string; confirm?: boolean }[] };
    const target = body.targets.find((candidate) => candidate.label === 'Delete demo record');
    expect(target?.confirm).toBe(true);
    await route.fulfill({ status: 200, json: { data: {
      kind: 'invoke', targetId: target?.id, value: null, needsConfirmation: true,
      speech: 'The record has been deleted.',
    } } });
  });
  await page.evaluate(() => { window.__voiceTranscript = 'delete demo record'; });

  await page.getByRole('button', { name: 'Voice command (Alt+V)' }).click();
  await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toBeVisible();
  expect(await page.getByRole('button', { name: 'Delete demo record' }).getAttribute('data-demo-deleted')).toBe('false');

  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Delete demo record' })).toHaveAttribute('data-demo-deleted', 'true');
  await expect(page.getByText('I triggered Delete demo record. Check the page for the result.')).toBeVisible();
  await expect(page.getByText('The record has been deleted.')).toHaveCount(0);
});

test('fills an accessible field locally without sending its value to the assistant model', async ({ page }) => {
  await signInAsEmployer(page);
  await mockAssistantApi(page);
  await page.goto('/platform/hire');
  await page.evaluate(() => {
    const label = document.createElement('label');
    label.htmlFor = 'voice-demo-title';
    label.textContent = 'Project title';
    const input = document.createElement('input');
    input.id = 'voice-demo-title';
    input.type = 'text';
    input.style.minHeight = '40px';
    const passwordLabel = document.createElement('label');
    passwordLabel.htmlFor = 'voice-demo-password';
    passwordLabel.textContent = 'Password';
    const password = document.createElement('input');
    password.id = 'voice-demo-password';
    password.type = 'password';
    document.querySelector('main')?.append(label, input, passwordLabel, password);
  });
  await page.evaluate(() => { window.__voiceTranscript = 'Set project title to Staff Engineer'; });

  await page.getByRole('button', { name: 'Voice command (Alt+V)' }).click();
  await expect(page.getByLabel('Project title')).toHaveValue('Staff Engineer');
  expect(await page.evaluate(() => window.__assistantRequests)).toBe(0);
  await expect(page.getByText('Updated Project title.')).toBeVisible();

  await page.evaluate(() => { window.__voiceTranscript = 'Set password to hunter2-demo'; });
  await page.getByRole('button', { name: 'Voice command (Alt+V)' }).click();
  await expect(page.getByLabel('Password')).toHaveValue('');
  await expect(page.getByText(/I did not send its value anywhere/)).toBeVisible();
  expect(await page.evaluate(() => window.__assistantRequests)).toBe(0);
  expect(await page.evaluate(() => window.__neuralRequests.some(({ text }) => text.includes('hunter2-demo')))).toBe(false);
});
