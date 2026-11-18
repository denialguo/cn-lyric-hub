/**
 * One-off production browser test for CN Lyrics community contributions.
 * Uses ONLY the public UI, never SQL/service-role writes.
 * Test users are visibly labeled cnlyrics_qa_e2e_*.
 * The test leaves useful QA corrections in line_translations, but undoes its vote.
 *
 * Requires E2E_RUN_PRODUCTION=YES so this cannot run by accident.
 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { chromium } from 'playwright';

const BASE_URL = 'https://cnlyrics.app';
const fixes = JSON.parse(await readFile(new URL('./fixtures/community-translation-corrections.json', import.meta.url), 'utf8'));
const suffix = randomBytes(6).toString('hex');
const accounts = ['a', 'b'].map(side => ({
  username: `cnlyrics_qa_e2e_${side}_${suffix}`,
  email: `cnlyrics-qa-${side}-${suffix}@example.com`,
  password: randomBytes(28).toString('base64url') + 'X4!',
}));

const log = (message) => console.log('[CN Lyrics E2E]', message);

async function registerViaBrowser(page, account) {
  await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Sign Up', exact: true }).click();
  await page.getByPlaceholder('Username').fill(account.username);
  await page.getByPlaceholder('Email address').fill(account.email);
  await page.getByPlaceholder('Password').fill(account.password);
  await page.getByRole('button', { name: 'Create Account', exact: true }).click();

  // The production version may still have a misleading hardcoded verification toast.
  // Success toast is not used as proof of authentication.
  await page.getByText('Account created!', { exact: false }).first().waitFor({ timeout: 20000 });
  log('Signup form accepted QA account ' + account.username);
}

async function openLine(page, fix) {
  await page.goto(BASE_URL + '/song/' + fix.slug, { waitUntil: 'domcontentloaded' });
  const line = page.getByRole('button', { name: new RegExp('^Line ' + fix.line + ':') });
  await line.waitFor({ timeout: 25000 });

  const lineLabel = await line.getAttribute('aria-label');
  assert.ok(lineLabel?.includes(fix.original), 'Source text mismatch for song ' + fix.song_id + ', line ' + fix.line + '. REFUSING TO WRITE.');

  await line.click();
  const dialog = page.getByRole('dialog', { name: 'Line #' + fix.line });
  await dialog.waitFor();
  await dialog.locator('svg.animate-spin').waitFor({ state: 'hidden', timeout: 20000 });
  assert.equal(await dialog.getByRole('alert').count(), 0, 'Contribution data failed to load');
  return dialog;
}

function contribution(dialog, content) {
  return dialog.getByText(content, { exact: true }).first();
}

async function selectVote(dialog, content) {
  const paragraph = contribution(dialog, content);
  await paragraph.waitFor();
  return paragraph.locator('xpath=..').getByRole('button', { name: 'Like community translation' });
}

test('real signup, community translation submission, cross-account voting and vote reversal', { timeout: 480000 }, async () => {
  assert.equal(process.env.E2E_RUN_PRODUCTION, 'YES', 'Explicit production E2E opt-in required');

  const browser = await chromium.launch();
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();
  pageA.setDefaultTimeout(20000);
  pageB.setDefaultTimeout(20000);

  try {
    // Two separate browsers, with no shared cookies/localStorage.
    await registerViaBrowser(pageA, accounts[0]);
    await registerViaBrowser(pageB, accounts[1]);

    const first = await openLine(pageA, fixes[0]);
    const input = first.getByRole('textbox', { name: 'Propose a translation' });
    if (!await input.isEnabled()) {
      throw new Error('SIGNUP_NO_SESSION: Signup succeeded but no authenticated session. Email confirmation may be enabled; did not write translations.');
    }
    log('Fresh QA signup produced a usable real-account session.');

    let inserted = 0;
    let existing = 0;
    // Only submit previously reviewed English corrections, never change canonical lyrics.
    for (const fix of fixes) {
      const dialog = fix === fixes[0] ? first : await openLine(pageA, fix);
      const saved = contribution(dialog, fix.recommended_translation);
      if (await saved.count()) {
        existing++;
        continue;
      }
      const box = dialog.getByRole('textbox', { name: 'Propose a translation' });
      assert.ok(await box.isEnabled(), 'Submission input unexpectedly disabled');
      await box.fill(fix.recommended_translation);
      await dialog.getByRole('button', { name: 'Send contribution' }).click();
      await saved.waitFor({ timeout: 20000 });
      inserted++;
      log('Saved community translation for song ' + fix.song_id + ' line ' + fix.line);
    }
    log('Submitted ' + inserted + ' QA translations; ' + existing + ' already existed.');

    const dialogB = await openLine(pageB, fixes[0]);
    let vote = await selectVote(dialogB, fixes[0].recommended_translation);
    assert.ok(await vote.isEnabled(), 'Vote button disabled for second QA account');
    assert.equal(await vote.getAttribute('aria-pressed'), 'false', 'Unexpected prior vote on fresh QA account');
    await vote.click();
    assert.equal(await vote.getAttribute('aria-pressed'), 'true', 'Vote did not update optimistically');

    // Must survive a full page reload: not just a cosmetic counter update.
    const afterVote = await openLine(pageB, fixes[0]);
    vote = await selectVote(afterVote, fixes[0].recommended_translation);
    assert.equal(await vote.getAttribute('aria-pressed'), 'true', 'Vote not persisted after reload');

    await vote.click();
    assert.equal(await vote.getAttribute('aria-pressed'), 'false', 'Vote removal did not update');
    const afterUndo = await openLine(pageB, fixes[0]);
    vote = await selectVote(afterUndo, fixes[0].recommended_translation);
    assert.equal(await vote.getAttribute('aria-pressed'), 'false', 'Vote removal not persisted');

    // Contributions are left labeled as QA submissions; QA voting is removed.
    log('PASS: two browser signups, saved translations, cross-account vote, persistence, and undo.');
  } finally {
    await ctxA.close();
    await ctxB.close();
    await browser.close();
  }
});
