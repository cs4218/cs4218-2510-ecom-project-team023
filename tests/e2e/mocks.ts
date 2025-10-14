// tests/e2e/mocks.ts
import type { Page, Route, Request } from '@playwright/test';

const PNG_1x1 = Buffer.from(
  '89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000A49444154789C6360000002000100FFFF03000006000557BF6A0000000049454E44AE426082',
  'hex'
);

export const product = {
  _id: '68ecb39346000991f8a1be23',
  name: 'Laptop',
  price: 1500,
  description: 'High performance laptop',
  image: '/images/laptop.jpg',
  stock: 10,
  category: { _id: 'cat1', name: 'Electronics' },
  slug: 'laptop-123'
};

export const related = [
  { _id: '68ecb39346000991f8a1be26', name: 'Mouse',    price: 25, image: '/images/mouse.jpg',    slug: 'mouse-abc' },
  { _id: '68ecb39346000991f8a1be27', name: 'Keyboard', price: 70, image: '/images/keyboard.jpg', slug: 'keyboard-xyz' }
];

export const categories = [
  { _id: 'cat1', name: 'Electronics', slug: 'electronics' },
  { _id: 'cat2', name: 'Books', slug: 'books' },
];

const re = {
  productList:       /\/api\/v1\/product\/product-list\/\d+$/i,
  productCount:      /\/api\/v1\/product\/product-count$/i,
  productFilters:    /\/api\/v1\/product\/product-filters$/i,
  categories:        /\/api\/v1\/category\/get-category$/i,
  getProductBySlug:  /\/api\/v1\/product\/get-product\/[^/?#]+$/i,
  relatedByPid:      /\/api\/v1\/product\/related-product\/[^/?#]+$/i,
  productPhoto:      /\/api\/v1\/product\/product-photo\/[^/?#]+$/i,
  cartAdd:           /\/api\/(?:v\d\/)?(?:cart\/add|products?\/cart\/add)$/i,
};

export async function mockHappyPaths(page: Page): Promise<void> {
  // --- Home page calls
  await page.route(re.categories, async (r: Route) =>
    r.fulfill({ json: { success: true, category: categories } })
  );
  await page.route(re.productList, async (r: Route) =>
    r.fulfill({ json: { products: [product, ...related] } })
  );
  await page.route(re.productCount, async (r: Route) =>
    r.fulfill({ json: { total: 1 + related.length } })
  );
  await page.route(re.productFilters, async (r: Route) =>
    r.fulfill({ json: { products: [product] } })
  );

  // --- Product details
  await page.route(re.getProductBySlug, async (r: Route) => {
    // let the loader appear
    await new Promise(res => setTimeout(res, 350));
    // return a "universal" shape so any parsing style works
    r.fulfill({ json: { success: true, product, products: [product] } });
  });

  await page.route(re.relatedByPid, async (r: Route) =>
    r.fulfill({ json: { success: true, products: related } })
  );

  await page.route(re.productPhoto, async (r: Route) =>
    r.fulfill({ status: 200, headers: { 'content-type': 'image/png' }, body: PNG_1x1 })
  );

  await page.route(re.cartAdd, async (route: Route) => {
    let qty = 1;
    try { qty = (route.request() as Request).postDataJSON()?.qty ?? 1; } catch {}
    await route.fulfill({ json: { success: true, qty } });
  });
}
