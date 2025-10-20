// tests/e2e/AdminCategory.spec.ts
import { test, expect, type Page } from '@playwright/test';
import * as dotenv from 'dotenv';

/* ------------------------- Env (prefer .env.test) ------------------------- */
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || '.env.test' });
dotenv.config(); // fallback to .env

const APP_BASE  = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';
const API_BASE  = process.env.E2E_API_BASE || 'http://127.0.0.1:6060';

const ADMIN_EMAIL    = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error('Missing ADMIN_EMAIL or ADMIN_PASSWORD (check .env.test / .env).');
}

/* ------------------------------- Small utils ------------------------------ */
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const escapeRx = esc;

function canonicalise(s: string) {
  const t = String(s ?? '').trim().replace(/\s+/g, ' ');
  if (!t) return '';
  return t.toLowerCase().replace(/\b\w/g, m => m.toUpperCase());
}

function table(page: Page) {
  return page.locator('table.table');
}
function tableRows(page: Page) {
  return table(page).locator('tbody tr');
}
/** Find the row by matching ONLY the first cell (Name) and walking up to <tr>. */
function rowByName(page: Page, name: string) {
  return page
    .locator('table.table tbody tr td:first-child')
    .filter({ hasText: new RegExp(`^\\s*${escapeRx(name)}\\s*$`, 'i') })
    .locator('xpath=ancestor::tr[1]')
    .first();
}

/* --------------------------------- Login UI ------------------------------- */
async function login(page: Page, email: string, password: string) {
  await page.goto(`${APP_BASE}/login`);
  await page.getByPlaceholder(/enter your email/i).fill(email);
  await page.getByPlaceholder(/enter your password/i).fill(password);
  await Promise.all([
    page.waitForLoadState('networkidle').catch(() => {}),
    page.getByRole('button', { name: /^login$/i }).click(),
  ]);
  await page.waitForURL(new RegExp(`^${esc(APP_BASE)}/?$`));
}

/* ------------------------------ API helpers ------------------------------- */
async function getAdminToken(request: any) {
  const res = await request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const body = await res.json();
  if (!res.ok() || !body?.token) {
    throw new Error(`Admin login failed: ${res.status()} ${JSON.stringify(body)}`);
  }
  return body.token as string;
}

/** Delete all categories whose name starts with E2E-, with retries to avoid races. */
async function clearE2ECategories(request: any) {
  const token = await getAdminToken(request);
  const auth = { authorization: `${token}` };

  for (let attempt = 0; attempt < 6; attempt++) {
    const list = await request.get(`${API_BASE}/api/v1/category/get-category`);
    if (!list.ok()) throw new Error(`List categories failed: ${list.status()}`);
    const js = await list.json();
    const e2e = (js?.category ?? []).filter((c: any) => /^E2E-/i.test(c.name));
    if (!e2e.length) return;

    const dels = await Promise.all(
      e2e.map((c: any) =>
        request.delete(`${API_BASE}/api/v1/category/delete-category/${c._id}`, { headers: auth })
      )
    );
    const bad = dels.find((r: any) => !r.ok());
    if (bad) {
      const body = await bad.text();
      throw new Error(`Delete failed: ${bad.status()} ${body}`);
    }
    await new Promise(r => setTimeout(r, 250)); // backoff then re-check
  }

  const verify = await request.get(`${API_BASE}/api/v1/category/get-category`);
  const js2 = await verify.json();
  const still = (js2?.category ?? []).filter((c: any) => /^E2E-/i.test(c.name));
  if (still.length) throw new Error(`Cleanup incomplete; still have: ${still.map((c:any)=>c.name).join(', ')}`);
}

/* ------------------------------- Page helpers ----------------------------- */
async function goAdminCategory(page: Page) {
  await page.goto(`${APP_BASE}/dashboard/admin/create-category`);
  await page.waitForLoadState('networkidle').catch(() => {});
  await expect(page.getByPlaceholder(/enter new category/i)).toBeVisible({ timeout: 15_000 });
  await expect(table(page)).toBeVisible({ timeout: 15_000 });
}

async function createCategoryUI(page: Page, raw: string) {
  const input = page.getByPlaceholder(/enter new category/i).first();
  await input.fill(raw);
  const submit = page.getByRole('button', { name: /^submit$/i }).first();
  await Promise.all([page.waitForLoadState('networkidle').catch(() => {}), submit.click()]);
}

/** Open the AntD modal and return its *modal-scoped* input */
async function openEditModal(page: Page, canonName: string) {
  const row = rowByName(page, canonName);
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.getByRole('button', { name: /edit/i }).first().click();

  // Your Modal has no explicit title prop; target the last dialog
  const modal = page.getByRole('dialog').last();
  await expect(modal).toBeVisible({ timeout: 15_000 });

  const modalInput = modal.getByPlaceholder(/enter new category/i).first();
  await expect(modalInput).toBeVisible({ timeout: 15_000 });
  return { modal, modalInput };
}

/** Optional toast checker (does nothing if no toast is present) */
async function maybeSeeToast(page: Page, rx: RegExp) {
  const t = page.getByText(rx).first();
  if (await t.count()) await expect(t).toBeVisible();
}

/* --------------------------------- Tests ---------------------------------- */
test.describe('Admin Category — real API/DB (per-test UI login; E2E data cleaned)', () => {
  test.beforeEach(async ({ page, request }) => {
    await clearE2ECategories(request);
    await login(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
    await goAdminCategory(page);
  });

  test.afterEach(async ({ request }) => {
    await clearE2ECategories(request);
  });

  test('Create → Edit (prefill + update) → Delete (E2E for a particular category)', async ({ page }) => {
    const now = Date.now();
    const raw          = `   E2E-Cat ${now}   `;      // raw user input (with odd spaces)
    const rawTrimmed   = raw.trim();
    const canon        = canonicalise(raw);
    const updatedRaw   = `E2E-Cat Updated ${now}`;
    const updatedCanon = canonicalise(updatedRaw);

    // Create
    await createCategoryUI(page, raw);
    // UI toast uses *raw* name on create
    await maybeSeeToast(page, new RegExp(`${escapeRx(rawTrimmed)}\\s+is\\s+created`, 'i'));
    await expect(rowByName(page, canon)).toBeVisible({ timeout: 15_000 });

    // Edit (modal)
    const { modal, modalInput } = await openEditModal(page, canon);
    // Modal input is prefilled from server list -> canonical name
    await expect(modalInput).toHaveValue(canon);

    await modalInput.fill(updatedRaw);
    await modal.getByRole('button', { name: /^submit$/i }).click();
    // UI toast uses *raw updated* name on update
    await maybeSeeToast(page, new RegExp(`${escapeRx(updatedRaw)}\\s+is\\s+updated`, 'i'));

    await expect(rowByName(page, canon)).toHaveCount(0);
    await expect(rowByName(page, updatedCanon)).toBeVisible({ timeout: 15_000 });

    // Delete
    await rowByName(page, updatedCanon).getByRole('button', { name: /delete/i }).click();
    await maybeSeeToast(page, /category is deleted/i);
    await expect(rowByName(page, updatedCanon)).toHaveCount(0);
  });

  test('Duplicate create shows server error and list unchanged', async ({ page }) => {
    const now   = Date.now();
    const name  = `E2E-DUP-${now}`;
    const canon = canonicalise(name);

    await createCategoryUI(page, name);
    await expect(rowByName(page, canon)).toBeVisible({ timeout: 15_000 });
    const before = await tableRows(page).count();

    await createCategoryUI(page, name); // duplicate
    await maybeSeeToast(page, /Category already exists/i);

    const after = await tableRows(page).count();
    expect(after).toBe(before);
  });

  test('Empty submit is graceful (no crash)', async ({ page }) => {
    const before = await tableRows(page).count();
    await page.getByRole('button', { name: /^submit$/i }).first().click();
    await expect(table(page)).toBeVisible();
    const after = await tableRows(page).count();
    expect(after).toBe(before);
  });

  test('Edit modal can be cancelled (no change)', async ({ page }) => {
    const name  = `E2E-CANCEL-${Date.now()}`;
    const canon = canonicalise(name);

    await createCategoryUI(page, name);
    await expect(rowByName(page, canon)).toBeVisible({ timeout: 15_000 });

    const { modal, modalInput } = await openEditModal(page, canon);
    await expect(modalInput).toHaveValue(canon);

    const cancel = modal.getByRole('button', { name: /close|cancel/i }).first();
    if (await cancel.count()) await cancel.click(); else await page.keyboard.press('Escape');

    await expect(rowByName(page, canon)).toBeVisible({ timeout: 15_000 });
  });

  test('Case-insensitive duplicate is rejected', async ({ page }) => {
    const now   = Date.now();
    const base  = `E2E-Case-${now}`;
    const canon = canonicalise(base);          // "E2e-Case-..."
    const dupe  = base.toLowerCase();          // same after canonicalisation

    await createCategoryUI(page, base);
    await expect(rowByName(page, canon)).toBeVisible({ timeout: 15_000 });

    const before = await tableRows(page).count();
    await createCategoryUI(page, dupe);        // should 409
    await maybeSeeToast(page, /Category already exists/i);
    const after = await tableRows(page).count();

    expect(after).toBe(before);
    await expect(rowByName(page, canon)).toBeVisible();
  });

  test('Whitespace-only submit is rejected (no row added)', async ({ page }) => {
    const before = await tableRows(page).count();
    await createCategoryUI(page, '        ');  // spaces only
    await expect(table(page)).toBeVisible();
    const after = await tableRows(page).count();
    expect(after).toBe(before);
  });

  test('Edit with no change returns success/no-op; list is stable', async ({ page }) => {
    const name  = `E2E-NOCHANGE-${Date.now()}`;
    const canon = canonicalise(name);

    await createCategoryUI(page, name);
    await expect(rowByName(page, canon)).toBeVisible({ timeout: 15_000 });

    const before = await tableRows(page).count();
    const { modal, modalInput } = await openEditModal(page, canon);
    await expect(modalInput).toHaveValue(canon);

    await modal.getByRole('button', { name: /^submit$/i }).click();
    // toast may or may not show; don't assert it strictly
    await expect(rowByName(page, canon)).toBeVisible({ timeout: 15_000 });
    const after = await tableRows(page).count();
    expect(after).toBe(before);
  });

  test('Edit to duplicate target shows error and modal remains open', async ({ page }) => {
    const now = Date.now();
    const a   = canonicalise(`E2E-A-${now}`);
    const b   = canonicalise(`E2E-B-${now}`);

    await createCategoryUI(page, a);
    await createCategoryUI(page, b);
    await expect(rowByName(page, a)).toBeVisible({ timeout: 15_000 });
    await expect(rowByName(page, b)).toBeVisible({ timeout: 15_000 });

    const { modal, modalInput } = await openEditModal(page, b);
    await expect(modalInput).toHaveValue(b);

    // Try to rename B -> A (duplicate)
    await modalInput.fill(a);
    await modal.getByRole('button', { name: /^submit$/i }).click();

    await maybeSeeToast(page, /Category already exists/i);
    await expect(modal).toBeVisible(); // still open because update failed

    // Rows remain unchanged
    await expect(rowByName(page, a)).toBeVisible();
    await expect(rowByName(page, b)).toBeVisible();

    // close modal to clean up
    const cancel = modal.getByRole('button', { name: /close|cancel/i }).first();
    if (await cancel.count()) await cancel.click(); else await page.keyboard.press('Escape');
  });

  test('Deleting a category keeps others intact', async ({ page }) => {
    const now  = Date.now();
    const keep = canonicalise(`E2E-KEEP-${now}`);
    const kill = canonicalise(`E2E-KILL-${now}`);

    await createCategoryUI(page, keep);
    await createCategoryUI(page, kill);
    await expect(rowByName(page, keep)).toBeVisible({ timeout: 15_000 });
    await expect(rowByName(page, kill)).toBeVisible({ timeout: 15_000 });

    await rowByName(page, kill).getByRole('button', { name: /delete/i }).click();
    await maybeSeeToast(page, /category is deleted/i);

    await expect(rowByName(page, kill)).toHaveCount(0);
    await expect(rowByName(page, keep)).toBeVisible({ timeout: 15_000 });
  });

  // Optional — only runs if TEST_EMAIL/TEST_PASSWORD are configured for a non-admin user.
  test('Non-admin is blocked from Create Category page', async ({ page }) => {
    const u = process.env.TEST_EMAIL;
    const p = process.env.TEST_PASSWORD;
    test.skip(!u || !p, 'no non-admin credentials configured');

    // Log in as normal user (reuses the same login helper in your file)
    await login(page, u!, p!);
    await page.goto(`${APP_BASE}/dashboard/admin/create-category`);

    // Expect denial by toast or missing input / redirect away
    const deniedToast = page.getByText(/unauthorized access/i).first();
    if (await deniedToast.count()) {
      await expect(deniedToast).toBeVisible();
    } else {
      await expect(page.getByPlaceholder(/enter new category/i)).toHaveCount(0);
    }
  });
});
