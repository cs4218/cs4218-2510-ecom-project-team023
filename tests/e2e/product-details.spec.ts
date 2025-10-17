import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const PRODUCT_NAME_RX = /laptop/i;

/* ---------------------------- Helper functions ---------------------------- */
// written with help from ChatGPT

async function applyAnyFilter(page: Page) {
  const categoryNames = [/^electronics$/i, /^books?$/i, /^clothing$/i];
  for (const rx of categoryNames) {
    const cb = page.getByRole('checkbox', { name: rx }).first();
    if (await cb.count()) {
      if (!(await cb.isChecked().catch(() => false))) await cb.check();
      await page.waitForLoadState('networkidle').catch(() => {});
      return;
    }
  }

  const anyCb = page.getByRole('checkbox').first();
  if (await anyCb.count()) {
    if (!(await anyCb.isChecked().catch(() => false))) await anyCb.check();
    await page.waitForLoadState('networkidle').catch(() => {});
    return;
  }

  const minInput = page.locator('input[name*="min" i], input[placeholder*="min" i]').first();
  const maxInput = page.locator('input[name*="max" i], input[placeholder*="max" i]').first();
  if (await minInput.count() || await maxInput.count()) {
    if (await minInput.count()) await minInput.fill('1');
    if (await maxInput.count()) await maxInput.fill('999999');
    const applyBtn = page.getByRole('button', { name: /filter|apply|go/i }).first();
    if (await applyBtn.count()) {
      await Promise.all([
        page.waitForLoadState('networkidle').catch(() => {}),
        applyBtn.click(),
      ]);
    }
  }
}

async function goHome(page: Page) {
  await page.goto(BASE_URL);
  await expect(page).toHaveURL(/\/$/);
}

async function findSearchBox(page: Page) {
  const candidates = [
    page.getByRole('searchbox').first(),
    page.locator('input[placeholder*="search" i]').first(),
    page.locator('input[type="search"]').first(),
    page.locator('form input').first(),
  ];
  for (const el of candidates) {
    if (await el.count()) return el;
  }
  return page.locator('input'); // last resort
}

async function searchFor(page: Page, query: string) {
  const box = await findSearchBox(page);
  await box.fill(query);
  // Prefer clicking a Search button if present; otherwise Enter
  const btn = page.getByRole('button', { name: /search/i }).first();
  if (await btn.count()) {
    await Promise.all([
      page.waitForLoadState('networkidle').catch(() => {}),
      btn.click(),
    ]);
  } else {
    await Promise.all([
      page.waitForLoadState('networkidle').catch(() => {}),
      page.keyboard.press('Enter'),
    ]);
  }
  // We should be on a search results view or results are visible inline
}

async function openPdpFromResults(page: Page, nameRx: RegExp) {
  // Prefer a card that actually contains a heading with the product name
  const card = page
    .locator('.card, [data-testid="product-card"], article, li, .product-item')
    .filter({ hasText: nameRx })
    .first();

  await expect(card).toBeVisible({ timeout: 10_000 });

  // Prefer an explicit "More Details" button/link if present
  const moreBtn = card.getByRole('button', { name: /more details|details|view/i }).first();
  const linkToPdp = card.locator('a[href*="/product/"]').first();
  const imgClickable = card.getByRole('img', { name: nameRx }).first();

  const clickTarget =
    (await moreBtn.count()) ? moreBtn :
    (await linkToPdp.count()) ? linkToPdp :
    (await imgClickable.count()) ? imgClickable : card;

  const prevUrl = page.url();
  await clickTarget.click();
  await page.waitForFunction((u) => window.location.href !== u, prevUrl, { timeout: 10_000 });
  await page.waitForLoadState('networkidle').catch(() => {});
}

async function assertOnPdp(page: Page, nameRx: RegExp) {
  // Accept either a top heading or the "Name : ..." line
  const candidates = [
    page.locator('h1, h2, h3, [data-testid="product-name"]').filter({ hasText: nameRx }).first(),
    page.getByText(new RegExp(String.raw`Name\s*:\s*${nameRx.source}`, 'i')).first(),
  ];
  for (const c of candidates) {
    if (await c.count()) {
      await expect(c).toBeVisible({ timeout: 10_000 });
      return;
    }
  }
  // Fallback: price line or product image
  await expect(page.getByText(/price\s*:/i)).toBeVisible({ timeout: 10_000 });
}

async function addToCartViaUi(page: Page) {
  // If a quantity selector exists, leave as default (or choose '1')
  const qty = page.getByRole('combobox').first();
  if (await qty.count()) {
    await qty.selectOption({ label: '1' }).catch(() => {});
  }
  const addBtn = page.getByRole('button', { name: /add to cart/i }).first();
  await expect(addBtn).toBeVisible({ timeout: 10_000 });
  await addBtn.click();
}

async function getCartLS(page: Page) {
  return page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('cart') || '[]'); } catch { return []; }
  });
}

async function expectCartCountIncreases(page: Page, prevLen: number) {
  await expect
    .poll(async () => (await getCartLS(page)).length, {
      timeout: 10_000,
      intervals: [200, 400, 800, 1200, 1600, 2000],
    })
    .toBeGreaterThan(prevLen);
}

/* --------------------------------- Tests --------------------------------- */

test.describe('E2E - Product Flows', () => {
  test.beforeEach(async ({ page }) => {
    await goHome(page);
  });

  test('loads product details page', async ({ page }) => {
    await searchFor(page, 'Laptop');
    await openPdpFromResults(page, PRODUCT_NAME_RX);
    await assertOnPdp(page, PRODUCT_NAME_RX);

    await expect(page.getByText(/category\s*:/i).first()).toBeVisible();
    await expect(page.getByText(/\$\s*\d+(\.\d{2})?/i).first()).toBeVisible();
  });

  test('FLOW: Search → PDP → Add to Cart', async ({ page }) => {
    await searchFor(page, 'Laptop');
    await openPdpFromResults(page, PRODUCT_NAME_RX);
    await assertOnPdp(page, PRODUCT_NAME_RX);

    const before = (await getCartLS(page)).length;
    await addToCartViaUi(page);

    await expectCartCountIncreases(page, before);

    const toast = page.getByText(/added to cart|item added/i).first();
    if (await toast.count()) await expect(toast).toBeVisible();
  });

  test('FLOW: Category → PDP → Add to Cart', async ({ page }) => {
    const catLink = page.getByRole('link', { name: /electronics/i }).first();
    if (await catLink.count()) {
      await Promise.all([
        page.waitForLoadState('networkidle').catch(() => {}),
        catLink.click(),
      ]);
    } else {
      await searchFor(page, 'Laptop');
    }

    await openPdpFromResults(page, PRODUCT_NAME_RX);
    await assertOnPdp(page, PRODUCT_NAME_RX);

    const before = (await getCartLS(page)).length;
    await addToCartViaUi(page);
    await expectCartCountIncreases(page, before);
  });

  test('FLOW: PDP → Related product → PDP (skip if none)', async ({ page }) => {
    await searchFor(page, 'Laptop');
    await openPdpFromResults(page, PRODUCT_NAME_RX);
    await assertOnPdp(page, PRODUCT_NAME_RX);

    const relatedHeader = page.getByRole('heading', { name: /similar products/i }).first();
    const noRelated = page.getByText(/no similar products/i).first();

    if (!(await relatedHeader.count()) && !(await noRelated.count())) {
      test.skip(true, 'No related section or message present on this PDP.');
    }

    if (await noRelated.count()) {
      test.skip(true, 'No related products available for this item.');
    }

    const relatedCard = page.locator('.card').filter({ has: page.getByRole('heading') }).first();
    if (!(await relatedCard.count())) {
      test.skip(true, 'No related product card rendered.');
    }

    const more = relatedCard.getByRole('button', { name: /more details|details|view/i }).first();
    const link = relatedCard.locator('a[href*="/product/"]').first();
    const target = (await more.count()) ? more : link;

    if (!(await target.count())) {
      test.skip(true, 'No related "More Details" or link found.');
    }

    const prev = page.url();
    await target.click();
    await page.waitForFunction((u) => window.location.href !== u, prev, { timeout: 10_000 });
    await page.waitForLoadState('networkidle').catch(() => {});
    const possibleHeadings = page.locator('h1, h2, h3, [data-testid="product-name"], h6');
    await expect(
      possibleHeadings.filter({ hasText: /product details|name\s*:/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('cart persists after page reload', async ({ page }) => {
    // Reach PDP
    await searchFor(page, 'Laptop');
    await openPdpFromResults(page, PRODUCT_NAME_RX);
    await assertOnPdp(page, PRODUCT_NAME_RX);

    // Add to cart
    const before = (await getCartLS(page)).length;
    await addToCartViaUi(page);
    await expectCartCountIncreases(page, before);

    // Reload and verify it’s still there
    await page.reload();
    await expect
      .poll(async () => (await getCartLS(page)).length, { timeout: 10_000 })
      .toBeGreaterThan(0);
  });
});

test.describe('E2E - Search Flows (Real Backend)', () => {
  test('FLOW: Search → Add to Cart → PDP → Add Again', async ({ page }) => {
  // Go home and search
  await page.goto(BASE_URL);
  await searchFor(page, 'Laptop');

  // Ensure a result card exists
  const laptopCard = page
    .locator('.card, [data-testid="product-card"], article, li, .product-item')
    .filter({ hasText: /laptop/i })
    .first();
  await expect(laptopCard).toBeVisible({ timeout: 10_000 });

  // Add to cart from search results
  const before = (await getCartLS(page)).length;
  const addBtn = laptopCard.getByRole('button', { name: /add to cart/i }).first();
  await expect(addBtn).toBeVisible();
  await addBtn.click();
  await expectCartCountIncreases(page, before);

  await openPdpFromResults(page, PRODUCT_NAME_RX);
  await assertOnPdp(page, PRODUCT_NAME_RX);

  // Add again from PDP
  const beforePdp = (await getCartLS(page)).length;
  await addToCartViaUi(page);
  await expectCartCountIncreases(page, beforePdp);

  const toast = page.getByText(/added to cart|item added/i).first();
  if (await toast.count()) await expect(toast).toBeVisible();
});


  test('FLOW: Search → No Results (Invalid Query)', async ({ page }) => {
    await page.goto(BASE_URL);

    // Search for something nonexistent
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('BananaPhoneXYZ');
    await page.keyboard.press('Enter');

    // Wait for search to complete
    await page.waitForLoadState('networkidle');

    // Verify “no results” UI
    const noResultsMsg = page.getByText(/no products found/i);
    await expect(noResultsMsg).toBeVisible({ timeout: 8000 });

    // Ensure there are no product cards
    const productCards = page.locator('.card');
    await expect(productCards).toHaveCount(0);
  });
});

test('FLOW: Filter (Electronics/Books/Clothing) → Add (listing) → PDP → Add', async ({ page }) => {
  await page.goto(BASE_URL);

  const catLink = page.getByRole('link', { name: /electronics|books?|clothing/i }).first();
  if (await catLink.count()) {
    await Promise.all([
      page.waitForLoadState('networkidle').catch(() => {}),
      catLink.click(),
    ]);
  }

  await applyAnyFilter(page);

  const laptopCard = page
    .locator('.card, [data-testid="product-card"], article, li, .product-item')
    .filter({ hasText: PRODUCT_NAME_RX })
    .first();
  await expect(laptopCard).toBeVisible({ timeout: 10_000 });

  const before = (await getCartLS(page)).length;
  const addBtn = laptopCard.getByRole('button', { name: /add to cart/i }).first();
  await expect(addBtn).toBeVisible();
  await addBtn.click();
  await expectCartCountIncreases(page, before);

  await openPdpFromResults(page, PRODUCT_NAME_RX);
  await assertOnPdp(page, PRODUCT_NAME_RX);

  const beforePdp = (await getCartLS(page)).length;
  await addToCartViaUi(page);
  await expectCartCountIncreases(page, beforePdp);

  const toast = page.getByText(/added to cart|item added/i).first();
  if (await toast.count()) await expect(toast).toBeVisible();
});

test('FLOW: Books (Novel) add → Search Laptop → PDP add → Cart has Novel & Laptop', async ({ page }) => {
  await page.goto(BASE_URL);

  const booksLink = page.getByRole('link', { name: /^books?$/i }).first();
  if (await booksLink.count()) {
    await Promise.all([
      page.waitForLoadState('networkidle').catch(() => {}),
      booksLink.click(),
    ]);
  }

  // 2) Apply "Books" filter if there’s a checkbox
  const booksCb = page.getByRole('checkbox', { name: /^books?$/i }).first();
  if (await booksCb.count()) {
    if (!(await booksCb.isChecked().catch(() => false))) await booksCb.check();
    await page.waitForLoadState('networkidle').catch(() => {});
  }

  let novelCard = page
    .locator('.card, [data-testid="product-card"], article, li, .product-item')
    .filter({ hasText: /novel/i })
    .first();

  if (!(await novelCard.count())) {
    await (async () => {
      const input =
        (await page.getByRole('searchbox').first().count()) ? page.getByRole('searchbox').first()
        : (await page.locator('input[placeholder*="search" i]').first().count()) ? page.locator('input[placeholder*="search" i]').first()
        : page.locator('input[type="search"]').first();
      await input.fill('Novel');
      const btn = page.getByRole('button', { name: /search/i }).first();
      if (await btn.count()) await btn.click(); else await page.keyboard.press('Enter');
      await page.waitForLoadState('networkidle').catch(() => {});
    })();

    novelCard = page
      .locator('.card, [data-testid="product-card"], article, li, .product-item')
      .filter({ hasText: /novel/i })
      .first();
  }

  await expect(novelCard).toBeVisible({ timeout: 10_000 });

  const beforeBooks = (await getCartLS(page)).length;
  const addFromListing = novelCard.getByRole('button', { name: /add to cart/i }).first();
  if (await addFromListing.count()) {
    await addFromListing.click();
    await expectCartCountIncreases(page, beforeBooks);
  } else {
    await openPdpFromResults(page, /novel/i);
    await assertOnPdp(page, /novel/i);
    const beforeBooksPdp = (await getCartLS(page)).length;
    await addToCartViaUi(page);
    await expectCartCountIncreases(page, beforeBooksPdp);
  }

  await searchFor(page, 'Laptop');
  await openPdpFromResults(page, /laptop/i);
  await assertOnPdp(page, /laptop/i);

  const beforeLaptop = (await getCartLS(page)).length;
  await addToCartViaUi(page);
  await expectCartCountIncreases(page, beforeLaptop);

  const cart = await getCartLS(page);
  const hasNovel = cart.some((p: any) => /novel/i.test(String(p?.name || '')));
  const hasLaptop = cart.some((p: any) => /laptop/i.test(String(p?.name || '')));

  expect(hasNovel, 'Cart does not contain the "Novel" book').toBeTruthy();
  expect(hasLaptop, 'Cart does not contain a Laptop item').toBeTruthy();
});

