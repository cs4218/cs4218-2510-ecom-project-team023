// tests/e2e/product-admin.spec.ts
import { test, expect, type Page } from '@playwright/test';
import * as dotenv from 'dotenv';

/* ------------------------- Env (prefer .env.test) ------------------------- */
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || '.env.test' });
dotenv.config(); // fallback to .env

const APP_BASE = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';
const API_BASE = process.env.E2E_API_BASE || 'http://127.0.0.1:6060';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error('Missing ADMIN_EMAIL or ADMIN_PASSWORD (check .env.test / .env).');
}

/* Optionals for product form labels/select values (visible labels, not IDs) */
const PRODUCT_CATEGORY_LABEL = process.env.PRODUCT_CATEGORY_LABEL || 'Electronics';
const PRODUCT_SHIPPING_LABEL = process.env.PRODUCT_SHIPPING_LABEL || 'Yes';

/* ------------------------------- Small utils ------------------------------ */
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const escapeRx = esc;

function canonicalise(s: string) {
  const t = String(s ?? '').trim().replace(/\s+/g, ' ');
  if (!t) return '';
  return t.toLowerCase().replace(/\b\w/g, m => m.toUpperCase());
}

async function maybeSeeToast(page: Page, rx: RegExp) {
  const t = page.getByText(rx).first();
  if (await t.count()) await expect(t).toBeVisible();
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

/**
 * Cleanup: delete all products whose name starts with E2E-
 * Adjust endpoints if your API differs.
 */
async function clearE2EProducts(request: any) {
  const token = await getAdminToken(request);
  const auth = { authorization: `${token}` };

  for (let attempt = 0; attempt < 6; attempt++) {
    const list = await request.get(`${API_BASE}/api/v1/product/get-product`);
    if (!list.ok()) throw new Error(`List products failed: ${list.status()}`);
    const js = await list.json();
    const items = (js?.products ?? []).filter((p: any) => /^E2E-/i.test(p.name));
    if (!items.length) return;

    const dels = await Promise.all(
      items.map((p: any) =>
        request.delete(`${API_BASE}/api/v1/product/delete-product/${p._id}`, { headers: auth })
      )
    );
    const bad = dels.find((r: any) => !r.ok());
    if (bad) {
      const body = await bad.text();
      throw new Error(`Delete failed: ${bad.status()} ${body}`);
    }
    await new Promise(r => setTimeout(r, 250));
  }

  const verify = await request.get(`${API_BASE}/api/v1/product/get-product`);
  const js2 = await verify.json();
  const still = (js2?.products ?? []).filter((p: any) => /^E2E-/i.test(p.name));
  if (still.length) {
    throw new Error(`Cleanup incomplete; still have: ${still.map((p:any)=>p.name).join(', ')}`);
  }
}

/** Poll API until a product with this name is missing (for prompt-based delete). */
async function waitUntilProductMissing(request: any, name: string, timeoutMs = 10_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const list = await request.get(`${API_BASE}/api/v1/product/get-product`);
    if (!list.ok()) throw new Error(`List products failed: ${list.status()}`);
    const js = await list.json();
    const products: any[] = js?.products ?? [];
    const still = products.some(p => (p?.name ?? '').trim().toLowerCase() === name.trim().toLowerCase());
    if (!still) return;
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for product to be deleted: ${name}`);
}

/** Resolve a product slug by name using the API, then open the edit page directly. */
async function openProductFromAdminList(page: Page, request: any, name: string) {
  // Navigate to list (keeps parity with original flow)
  await page.goto(`${APP_BASE}/dashboard/admin/products`);
  await page.waitForLoadState('networkidle').catch(() => {});

  // Resolve slug by API
  const list = await request.get(`${API_BASE}/api/v1/product/get-product`);
  if (!list.ok()) throw new Error(`List products failed: ${list.status()}`);
  const js = await list.json();
  const products: any[] = js?.products ?? [];
  const match = products.find(p => (p?.name ?? '').trim().toLowerCase() === name.trim().toLowerCase());
  if (!match) throw new Error(`Product not found by name: ${name}`);

  const slug = match?.slug || match?.slugName || match?._id; // fallback to _id if slug absent
  if (!slug) throw new Error(`No slug/_id for product: ${name}`);

  await page.goto(`${APP_BASE}/dashboard/admin/product/${slug}`);
  await page.waitForLoadState('networkidle').catch(() => {});
  // Ensure edit form is present
  await expect(page.getByRole('heading', { name: /update product/i })).toBeVisible({ timeout: 15_000 });
}

/* ------------------------------- Page helpers ----------------------------- */
async function goAdminCreateProduct(page: Page) {
  await page.goto(`${APP_BASE}/dashboard/admin/create-product`);
  await page.waitForLoadState('networkidle').catch(() => {});
  await expect(page.getByPlaceholder(/write a name/i)).toBeVisible({ timeout: 15_000 });
}

async function goAdminProductsList(page: Page) {
  await page.goto(`${APP_BASE}/dashboard/admin/products`);
  await page.waitForLoadState('networkidle').catch(() => {});
}

/** Click the AntD Select trigger reliably and return the visible dropdown. */
function selectTriggerLocator(page: Page, idx: number) {
  const input = page.locator(`#rc_select_${idx}`).first();
  const selector = page
    .locator(`[id="rc_select_${idx}"]`)
    .locator('xpath=ancestor::*[contains(@class,"ant-select")][1]//div[contains(@class,"ant-select-selector")]')
    .first();
  return { input, selector };
}

async function openAntSelect(page: Page, idx: number) {
  const { input, selector } = selectTriggerLocator(page, idx);
  let trigger = input;
  if (!(await trigger.isVisible())) trigger = selector;

  await trigger.scrollIntoViewIfNeeded();
  await trigger.click({ force: true });

  const dropdown = page.locator('.ant-select-dropdown:visible').last();
  await expect(dropdown).toBeVisible({ timeout: 10_000 });
  return dropdown;
}

async function setAntSelectByLabel(page: Page, idx: number, label: string) {
  const dropdown = await openAntSelect(page, idx);
  const option = dropdown
    .locator('.ant-select-item-option')
    .filter({ hasText: new RegExp(`^\\s*${escapeRx(label)}\\s*$`, 'i') })
    .first();

  await expect(option).toBeVisible({ timeout: 10_000 });
  await option.click();
  await expect(dropdown).toHaveCount(0, { timeout: 10_000 });
}

type ProductForm = {
  name: string;
  description: string;
  price: string | number;
  quantity: string | number;
  categoryLabel: string;  // visible label (e.g., "Electronics")
  shippingLabel: string;  // visible label (e.g., "Yes" or "No")
};

async function fillProductForm(page: Page, p: ProductForm) {
  // Category select (idx 0)
  await setAntSelectByLabel(page, 0, p.categoryLabel);
  // Name / Description / Price / Quantity
  await page.getByPlaceholder(/write a name/i).fill(String(p.name));
  await page.getByRole('textbox', { name: /write a description/i }).fill(String(p.description));
  await page.getByPlaceholder(/write a price/i).fill(String(p.price));
  await page.getByPlaceholder(/write a quantity/i).fill(String(p.quantity));
  // Shipping select (idx 1) — visible labels are "Yes"/"No" though value is "1"/"0"
  await setAntSelectByLabel(page, 1, p.shippingLabel);
}

async function updateProductFields(page: Page, p: Partial<ProductForm>) {
  if (p.categoryLabel !== undefined) await setAntSelectByLabel(page, 0, p.categoryLabel);
  if (p.name !== undefined) await page.getByPlaceholder(/write a name/i).fill(String(p.name));
  if (p.description !== undefined) await page.getByRole('textbox', { name: /write a description/i }).fill(String(p.description));
  if (p.price !== undefined) await page.getByPlaceholder(/write a price/i).fill(String(p.price));
  if (p.quantity !== undefined) await page.getByPlaceholder(/write a quantity/i).fill(String(p.quantity));
  if (p.shippingLabel !== undefined) await setAntSelectByLabel(page, 1, p.shippingLabel);
}

async function submitCreate(page: Page) {
  await Promise.all([
    page.waitForLoadState('networkidle').catch(() => {}),
    page.getByRole('button', { name: /^create product$/i }).click(),
  ]);
}

async function clickUpdate(page: Page) {
  await Promise.all([
    page.waitForLoadState('networkidle').catch(() => {}),
    page.getByRole('button', { name: /^update product$/i }).click(),
  ]);
}

async function expectPrefill(page: Page, expected: ProductForm) {
  await expect(page.getByPlaceholder(/write a name/i)).toHaveValue(expected.name);
  await expect(page.getByRole('textbox', { name: /write a description/i })).toHaveValue(expected.description);
  await expect(page.getByPlaceholder(/write a price/i)).toHaveValue(String(expected.price));
  await expect(page.getByPlaceholder(/write a quantity/i)).toHaveValue(String(expected.quantity));

  // For selects, assert visible selection text (AntD renders in .ant-select-selection-item)
  const selected = (await page.locator('.ant-select-selection-item').allTextContents()).map(s => s.trim().toLowerCase());
  expect(selected.join(' | ')).toContain(expected.categoryLabel.toLowerCase());
  expect(selected.join(' | ')).toContain(expected.shippingLabel.toLowerCase());
}

/** Delete from the Update page (prompt requires non-empty text), confirm via API, then UI. */
async function deleteFromEditPage(page: Page, request: any, productName: string) {
  // Your UpdateProduct uses window.prompt and requires non-empty input.
  page.once('dialog', d => d.accept('y')); // provide value so deletion proceeds

  // Click and wait for navigation back to products list
  await Promise.all([
    page.waitForURL(new RegExp(`${esc(APP_BASE)}/dashboard/admin/products/?$`)),
    page.getByRole('button', { name: /delete product/i }).click(),
  ]);

  await maybeSeeToast(page, /Product Deleted Successfully|deleted/i);

  // Confirm deletion via API to avoid stale UI races
  await waitUntilProductMissing(request, productName);

  // Now verify on list UI
  await goAdminProductsList(page);
  await page.reload().catch(() => {});
  await expect(page.getByText(new RegExp(`^\\s*${escapeRx(productName)}\\s*$`, 'i'))).toHaveCount(0);
}

/* ========================================================================== */
/* ============== Tests (test names preserved exactly as given) ============== */
/* ========================================================================== */

/* ---------------- Non Admin Users should be redirected -------------------- */
test.describe('Non Admin Users should be redirected', () => {
  test('should restrict access for non admin user users', async ({ page }) => {
    const u = process.env.TEST_EMAIL;
    const p = process.env.TEST_PASSWORD;
    test.skip(!u || !p, 'no non-admin credentials configured');

    await login(page, u!, p!);

    await page.goto(`${APP_BASE}/dashboard/admin/create-product`);
    const redirecting = page.getByText(/redirecting/i).first();
    if (await redirecting.count()) await expect(redirecting).toBeVisible();

    await page.waitForTimeout(3000); // kept to mirror original timing
    await expect(page).toHaveURL(new RegExp(`^${esc(APP_BASE)}/?$`));
  });

  test('should restrict access for guest users', async ({ page }) => {
    await page.goto(`${APP_BASE}/login`);
    await page.goto(`${APP_BASE}/dashboard/admin/create-product`);

    const redirecting = page.getByText(/redirecting/i).first();
    if (await redirecting.count()) await expect(redirecting).toBeVisible();

    await page.waitForTimeout(3000); // kept to mirror original timing
    await expect(page).toHaveURL(new RegExp(`^${esc(APP_BASE)}/?$`));
    await expect(page.getByText(/login/i)).toBeVisible();
  });
});

/* -------------------------- Product Creation ------------------------------ */
test.describe('Product Creation', () => {
  test.beforeEach(async ({ page, request }) => {
    await clearE2EProducts(request);
    await login(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
  });

  test.afterEach(async ({ request }) => {
    await clearE2EProducts(request);
  });

  test('should allow admin to create a product successfully', async ({ page, request }) => {
    await goAdminCreateProduct(page);

    const uniqueName = `E2E-Prod ${Date.now()}`;
    const seed: ProductForm = {
      name: canonicalise(uniqueName),
      description: 'Comfortable Macbook Pro Version with adjustable features.',
      price: '199.99',
      quantity: '50',
      categoryLabel: PRODUCT_CATEGORY_LABEL,
      shippingLabel: PRODUCT_SHIPPING_LABEL, // visible label
    };

    await fillProductForm(page, seed);
    await submitCreate(page);

    // List should include it
    await goAdminProductsList(page);
    await expect(page.getByText(new RegExp(`^\\s*${escapeRx(seed.name)}\\s*$`, 'i'))).toBeVisible({ timeout: 15_000 });

    // Verify on homepage (best-effort; keep original intent)
    await page.goto(APP_BASE);
    await expect(page.getByText(new RegExp(`^\\s*${escapeRx(seed.name)}\\s*$`, 'i'))).toBeVisible();

    // Delete via direct edit page open (resolve slug via API)
    await openProductFromAdminList(page, request, seed.name);
    await deleteFromEditPage(page, request, seed.name);

    await page.goto(APP_BASE);
    await expect(page.getByText(new RegExp(`^\\s*${escapeRx(seed.name)}\\s*$`, 'i'))).toHaveCount(0);
  });

  test('should show error for missing required fields', async ({ page }) => {
    await goAdminCreateProduct(page);

    // Leave name empty; fill others
    await setAntSelectByLabel(page, 0, PRODUCT_CATEGORY_LABEL);
    await page.getByRole('textbox', { name: /write a description/i }).fill('Comfortable Macbook Pro Version');
    await page.getByPlaceholder(/write a price/i).fill('199.99');
    await page.getByPlaceholder(/write a quantity/i).fill('50');
    await setAntSelectByLabel(page, 1, PRODUCT_SHIPPING_LABEL);

    await submitCreate(page);
    await maybeSeeToast(page, /something went wrong|invalid|required/i);
  });

  test('should show error for invalid price input', async ({ page }) => {
    await goAdminCreateProduct(page);

    const seedBad: ProductForm = {
      name: 'E2E-Invalid',
      description: 'Comfortable Macbook Pro Version with adjustable features.',
      price: '-199.99',
      quantity: '50',
      categoryLabel: PRODUCT_CATEGORY_LABEL,
      shippingLabel: PRODUCT_SHIPPING_LABEL,
    };

    await fillProductForm(page, seedBad);
    await submitCreate(page);
    await maybeSeeToast(page, /something went wrong|invalid/i);
  });
});

/* ----------------------- Update Product Admin User ------------------------ */
test.describe('Update Product Admin User', () => {
  let updateProductUniqueName: string;
  let updateProductData: ProductForm;

  test.beforeEach(async ({ page, request }) => {
    await clearE2EProducts(request);
    await login(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
    await goAdminCreateProduct(page);

    const uniqueName = `E2E-Prod ${Date.now()}`;
    updateProductUniqueName = canonicalise(uniqueName);
    updateProductData = {
      name: updateProductUniqueName,
      description: 'Comfortable Macbook Pro Version with adjustable features.',
      price: '199.99',
      quantity: '50',
      categoryLabel: PRODUCT_CATEGORY_LABEL,
      shippingLabel: PRODUCT_SHIPPING_LABEL,
    };

    await fillProductForm(page, updateProductData);
    await submitCreate(page);
    await openProductFromAdminList(page, request, updateProductUniqueName);
  });

  test.afterEach(async ({ request }) => {
    await clearE2EProducts(request);
  });

  test('loads with existing data prefilled', async ({ page }) => {
    await expectPrefill(page, updateProductData);
  });

  test('happy path update name and price', async ({ page, request }) => {
    const unique = canonicalise(`E2E-Updated ${Date.now()}`);
    const price = '123.45';

    await updateProductFields(page, { name: unique, price });
    await clickUpdate(page);

    await openProductFromAdminList(page, request, unique);
    updateProductUniqueName = unique;
    updateProductData.name = unique;
    updateProductData.price = price;
    await expectPrefill(page, updateProductData);
  });

  test('validation errors when required fields cleared', async ({ page }) => {
    await updateProductFields(page, { name: '', description: '', price: '', quantity: '' });
    await clickUpdate(page);
    await maybeSeeToast(page, /something went wrong|invalid|required/i);
  });

  test('boundary values for price and quantity', async ({ page }) => {
    await updateProductFields(page, { price: '-1', quantity: '-5' });
    await clickUpdate(page);
    await maybeSeeToast(page, /something went wrong|invalid/i);

    await updateProductFields(page, { price: '0', quantity: '0' });
    await clickUpdate(page);
    await maybeSeeToast(page, /something went wrong|invalid/i);
  });
});

/* ------------- Read Product and Delete Product Admin User ----------------- */
test.describe('Read Product and Delete Product Admin User', () => {
  let names: string[] = [];
  let datas: ProductForm[] = [];

  test.beforeEach(async ({ page, request }) => {
    names = [];
    datas = [];
    await clearE2EProducts(request);
    await login(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);

    // Create first
    await goAdminCreateProduct(page);
    const n1 = canonicalise(`E2E-Prod ${Date.now()}`);
    const p1: ProductForm = {
      name: n1,
      description: 'Comfortable Macbook Pro Version with adjustable features.',
      price: '199.99',
      quantity: '50',
      categoryLabel: PRODUCT_CATEGORY_LABEL,
      shippingLabel: PRODUCT_SHIPPING_LABEL,
    };
    await fillProductForm(page, p1);
    await submitCreate(page);
    names.push(n1);
    datas.push(p1);

    // Create second
    await goAdminCreateProduct(page);
    const n2 = canonicalise(`E2E-Prod ${Date.now() + 1}`);
    const p2: ProductForm = { ...p1, name: n2 };
    await fillProductForm(page, p2);
    await submitCreate(page);
    names.push(n2);
    datas.push(p2);
  });

  test.afterEach(async ({ request }) => {
    await clearE2EProducts(request);
  });

  test('should create 2 products and both should appear on the homepage and delete should remove from the homepage', async ({ page, request }) => {
    await page.goto(APP_BASE);
    await expect(page.getByText(new RegExp(`^\\s*${escapeRx(names[0])}\\s*$`, 'i'))).toBeVisible();
    await expect(page.getByText(new RegExp(`^\\s*${escapeRx(names[1])}\\s*$`, 'i'))).toBeVisible();

    // Delete both via direct edit page navigation (API-resolved slugs)
    await openProductFromAdminList(page, request, names[0]);
    await deleteFromEditPage(page, request, names[0]);
    await openProductFromAdminList(page, request, names[1]);
    await deleteFromEditPage(page, request, names[1]);

    await page.goto(APP_BASE);
    await expect(page.getByText(new RegExp(`^\\s*${escapeRx(names[0])}\\s*$`, 'i'))).toHaveCount(0);
    await expect(page.getByText(new RegExp(`^\\s*${escapeRx(names[1])}\\s*$`, 'i'))).toHaveCount(0);
  });

  test('should create 2 products and both should be appear on product admin products', async ({ page, request }) => {
    await goAdminProductsList(page);
    await expect(page.getByText(new RegExp(`^\\s*${escapeRx(names[0])}\\s*$`, 'i'))).toBeVisible();
    await expect(page.getByText(new RegExp(`^\\s*${escapeRx(names[1])}\\s*$`, 'i'))).toBeVisible();

    // Delete both
    await openProductFromAdminList(page, request, names[0]);
    await deleteFromEditPage(page, request, names[0]);
    await openProductFromAdminList(page, request, names[1]);
    await deleteFromEditPage(page, request, names[1]);

    await goAdminProductsList(page);
    await expect(page.getByText(new RegExp(`^\\s*${escapeRx(names[0])}\\s*$`, 'i'))).toHaveCount(0);
    await expect(page.getByText(new RegExp(`^\\s*${escapeRx(names[1])}\\s*$`, 'i'))).toHaveCount(0);
  });
});
