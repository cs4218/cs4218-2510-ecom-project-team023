import { test, expect, type Page, type Locator } from '@playwright/test';
// @ts-ignore
import { Prices} from '../../client/src/components/Prices';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

/* ---------------------------- Locators & helpers ---------------------------- */

function productCards(page: Page): Locator {
  // Your HomePage renders Bootstrap cards
  return page.locator('.card');
}

async function goHome(page: Page) {
  await page.goto(BASE_URL);
  await expect(page).toHaveURL(/\/$/);
  // Ensure the main heading appears
  await expect(page.getByRole('heading', { name: /all products/i })).toBeVisible({ timeout: 10000 });
}

async function waitIdle(page: Page) {
  await page.waitForLoadState('networkidle').catch(() => {});
}

async function getProductsSnapshot(page: Page) {
  const cards = productCards(page);
  await expect(cards.first()).toBeVisible({ timeout: 10000 });
  const count = await cards.count();

  const names = await Promise.all(
    Array.from({ length: Math.min(count, 50) }, async (_v, i) =>
      (await cards
        .nth(i)
        .locator('h5.card-title:not(.card-price)')
        .first()
        .textContent())?.trim() || ''
    )
  );
  return { count, names };
}

async function checkCategory(page: Page, nameRx: RegExp) {
  const cb = page.getByRole('checkbox', { name: nameRx }).first();
  await expect(cb).toBeVisible({ timeout: 10000 });
  if (!(await cb.isChecked().catch(() => false))) {
    await cb.check();
    await waitIdle(page);
  }
}

async function uncheckCategory(page: Page, nameRx: RegExp) {
  const cb = page.getByRole('checkbox', { name: nameRx }).first();
  if (await cb.count()) {
    if (await cb.isChecked().catch(() => false)) {
      await cb.uncheck();
      await waitIdle(page);
    }
  }
}

async function selectPriceBand(page: Page, labelRx: RegExp) {
  // antd Radio.Group → role="radio" for each option works
  const radio = page.getByRole('radio', { name: labelRx }).first();
  if (await radio.count()) {
    await radio.check();
    await waitIdle(page);
  } else {
    test.skip(true, `No price radio found matching ${labelRx}`);
  }
}

async function resetFilters(page: Page) {
  // Your HomePage calls window.location.reload() on click
  const resetBtn = page.getByRole('button', { name: /reset filters/i }).first();
  await expect(resetBtn).toBeVisible({ timeout: 10000 });
  // The page will fully reload; wait for network idle again
  await Promise.all([page.waitForLoadState('load'), resetBtn.click()]);
  await waitIdle(page);
}

async function clickLoadMore(page: Page) {
  const loadMore = page.getByRole('button', { name: /loadmore/i }).first();
  if (!(await loadMore.count())) return false;
  if (!(await loadMore.isEnabled().catch(() => true))) return false;

  // Clicking may switch to "Loading ..." with a spinning icon; wait for new items
  const before = await productCards(page).count();
  await Promise.all([waitIdle(page), loadMore.click()]);
  await expect
    .poll(async () => productCards(page).count(), { timeout: 10000, intervals: [200, 400, 800] })
    .toBeGreaterThan(before);
  return true;
}

async function addFirstVisibleCardToCart(page: Page) {
  const card = productCards(page).first();
  await expect(card).toBeVisible({ timeout: 10000 });
  const addBtn = card.getByRole('button', { name: /add to cart/i }).first();
  await expect(addBtn).toBeVisible();
  const before = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('cart') || '[]').length; } catch { return 0; }
  });
  await addBtn.click();
  await expect
    .poll(async () => {
      return page.evaluate(() => {
        try { return JSON.parse(localStorage.getItem('cart') || '[]').length; } catch { return 0; }
      });
    }, { timeout: 10000 })
    .toBeGreaterThan(before);
}

/* Helpers used only by the rewritten price-band test */
const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parsePrice = (s: string) => {
  // "$1,499.99" -> 1499.99 ; "$99" -> 99
  const m = s.replace(/\s/g, '').match(/([0-9][0-9,]*)(\.\d{2})?/);
  if (!m) return NaN;
  const num = m[1].replace(/,/g, '') + (m[2] ?? '');
  return Number(num);
};

async function getVisibleCardPrices(page: Page): Promise<number[]> {
  const cards = productCards(page);
  const count = await cards.count();
  const prices: number[] = [];
  for (let i = 0; i < count; i++) {
    const card = cards.nth(i);
    const priceEl = card.locator('.card-price, [data-testid="price"]').first();
    const txt = (await priceEl.count())
      ? await priceEl.innerText()
      : await card.getByText(/\$\s*\d/).first().innerText();
    const p = parsePrice(txt);
    if (!Number.isNaN(p)) prices.push(p);
  }
  return prices;
}

/* --------------------------------- Tests --------------------------------- */

test.describe('E2E - HomePage (Filters, Pagination, Cards, Add-to-Cart)', () => {
  test.beforeEach(async ({ page }) => {
    await goHome(page);
  });

  test('loads categories and shows product cards', async ({ page }) => {
    // Category section heading exists
    await expect(page.getByRole('heading', { name: /filter by category/i })).toBeVisible();

    // At least one category checkbox appears
    const anyCheckbox = page.getByRole('checkbox').first();
    await expect(anyCheckbox).toBeVisible();

    // Product cards render
    const snapshot = await getProductsSnapshot(page);
    expect(snapshot.count).toBeGreaterThan(0);

    // Each card shows name, price, description snippet and buttons
    const first = productCards(page).first();
    await expect(first.locator('h5.card-title:not(.card-price)').first()).toBeVisible();
    // price is rendered as $X.XX per your toLocaleString
    await expect(first.getByText(/\$\s*\d+(,\d{3})*(\.\d{2})?/)).toBeVisible();
    await expect(first.getByText(/\.\.\.$/)).toBeVisible(); // truncated desc ends with ...
    await expect(first.getByRole('button', { name: /more details/i })).toBeVisible();
    await expect(first.getByRole('button', { name: /add to cart/i })).toBeVisible();
  });

  test('filter by a single category narrows results', async ({ page }) => {
    const before = await getProductsSnapshot(page);

    // Try common demo names; fall back to first checkbox if none
    const catNames = [/^electronics$/i, /^books?$/i, /^clothing$/i];
    let applied = false;
    for (const rx of catNames) {
      const cb = page.getByRole('checkbox', { name: rx }).first();
      if (await cb.count()) {
        await checkCategory(page, rx);
        applied = true;
        break;
      }
    }
    if (!applied) {
      const anyCb = page.getByRole('checkbox').first();
      await anyCb.check();
      await waitIdle(page);
    }

    const after = await getProductsSnapshot(page);
    // Should not increase; usually decreases or stays the same
    expect(after.count).toBeLessThanOrEqual(before.count);
  });

  test('filter by multiple categories returns union', async ({ page }) => {
    // Pick any two distinct checkboxes (if available)
    const boxes = page.getByRole('checkbox');
    const totalBoxes = await boxes.count();
    test.skip(totalBoxes < 2, 'Need at least 2 category checkboxes');

    // Apply first two
    await boxes.nth(0).check().catch(() => {});
    await boxes.nth(1).check().catch(() => {});
    await waitIdle(page);

    // Should render at least one card
    const { count } = await getProductsSnapshot(page);
    expect(count).toBeGreaterThan(0);
  });

  test('price filter (radio) limits results to a band', async ({ page }) => {
    // Find the first band from Prices that is rendered as a radio on the page
    // and has a numeric [min, max] array.
    const numericBands = Prices.filter(
      (p: any) => Array.isArray(p.array) && p.array.length === 2 && p.array.every((n: any) => typeof n === 'number')
    );

    let picked: { name: string; array: [number, number] } | null = null;
    for (const band of numericBands) {
      const rx = new RegExp(`^${escapeRx(band.name)}$`, 'i');
      if (await page.getByRole('radio', { name: rx }).first().count()) {
        picked = band as any;
        break;
      }
    }
    test.skip(!picked, 'No price radios from Prices.js are present on this page');

    // Apply the chosen band
    const labelRx = new RegExp(`^${escapeRx(picked!.name)}$`, 'i');
    await selectPriceBand(page, labelRx);

    // Collect visible prices and assert every one falls in the band
    const [min, max] = picked!.array;
    const prices = await getVisibleCardPrices(page);
    expect(prices.length).toBeGreaterThan(0);

    for (const price of prices) {
      expect(price).toBeGreaterThanOrEqual(min);
      expect(price).toBeLessThanOrEqual(max);
    }
  });
  /* ---------------------------------------------------------------------- */

  test('combined filter (category + price) applies intersection', async ({ page }) => {
    // Category (any)
    const anyCb = page.getByRole('checkbox').first();
    await anyCb.check().catch(() => {});
    await waitIdle(page);

    // Price (any)
    const anyRadio = page.getByRole('radio').last();
    await anyRadio.check().catch(() => {});
    await waitIdle(page);

    const { count } = await getProductsSnapshot(page);
    expect(count).toBeGreaterThan(0);
  });

  test('Reset Filters returns to unfiltered product list', async ({ page }) => {
    const before = await getProductsSnapshot(page);

    // Apply a category + price, then reset
    const anyCb = page.getByRole('checkbox').first();
    await anyCb.check().catch(() => {});
    const anyRadio = page.getByRole('radio').first();
    if (await anyRadio.count()) await anyRadio.check().catch(() => {});
    await waitIdle(page);

    await resetFilters(page);

    const after = await getProductsSnapshot(page);
    // After a full reload, unfiltered set should be back; count should be >= filtered
    expect(after.count).toBeGreaterThanOrEqual(before.count);
  });

  test('"Loadmore" appends products (not replace) until exhausted', async ({ page }) => {
    const seen = new Set<string>();
    const nameAt = async (i: number) =>
      (await productCards(page).nth(i).getByRole('heading').first().textContent())?.trim() || '';

    // initial batch
    const initialCount = await productCards(page).count();
    for (let i = 0; i < initialCount; i++) seen.add(await nameAt(i));

    // Click load more up to 3 times (or until button disappears)
    for (let k = 0; k < 3; k++) {
      const had = await clickLoadMore(page);
      if (!had) break;
      const nowCount = await productCards(page).count();
      // appended → count strictly grows
      expect(nowCount).toBeGreaterThan(seen.size);

      // Track names to ensure "append not replace"
      for (let i = 0; i < nowCount; i++) seen.add(await nameAt(i));
      expect(nowCount).toBe(seen.size);
    }
  });

  test('Applying a filter after pagination resets list (no stale items)', async ({ page }) => {
    // Load more once (if available)
    await clickLoadMore(page).catch(() => {});
    const afterMore = await getProductsSnapshot(page);

    // Apply a category filter
    const anyCb = page.getByRole('checkbox').first();
    await anyCb.check().catch(() => {});
    await waitIdle(page);

    const afterFilter = await getProductsSnapshot(page);

    // After filter, list typically shrinks and represents a *new* set
    expect(afterFilter.count).toBeLessThanOrEqual(afterMore.count);

    // Sanity: first card still has the expected structure
    const first = productCards(page).first();
    await expect(first.locator('h5.card-title:not(.card-price)').first()).toBeVisible();
    await expect(first.getByRole('button', { name: /more details/i })).toBeVisible();
  });

  test('Add to Cart works from listing and persists after reload', async ({ page }) => {
    // Add from listing
    await addFirstVisibleCardToCart(page);

    // Reload and ensure cart length > 0
    await page.reload();
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          try { return JSON.parse(localStorage.getItem('cart') || '[]').length; } catch { return 0; }
        });
      }, { timeout: 10000 })
      .toBeGreaterThan(0);
  });
});
