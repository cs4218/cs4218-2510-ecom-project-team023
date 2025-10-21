/**
 * @jest-environment node
 */

import request from "supertest";
import mongoose from "mongoose";

import {
  connectToTestDb,
  disconnectFromTestDb,
  resetTestDb,
} from "../../../config/testdb.js";

const resolveApp = async () => {
  const srvMod = await import("../../../server.js");
  const candidates = [
    srvMod,
    srvMod?.default,
    srvMod?.default?.default,
    srvMod?.app,
    srvMod?.default?.app,
    srvMod?.server,
    srvMod?.default?.server,
  ];
  const isExpress = (x) => typeof x === "function" && (x.handle || x.use);
  const isHttp = (x) =>
    x && typeof x.address === "function" && typeof x.close === "function";
  for (const c of candidates) {
    if (!c) continue;
    if (isExpress(c) || isHttp(c)) return c;
    if (c?.app && isExpress(c.app)) return c.app;
    if (c?.server && isHttp(c.server)) return c.server;
    if (typeof c === "function" && !c.handle && !c.address) {
      try {
        const maybe = c();
        if (isExpress(maybe) || isHttp(maybe)) return maybe;
        if (maybe?.app && isExpress(maybe.app)) return maybe.app;
        if (maybe?.server && isHttp(maybe.server)) return maybe.server;
      } catch {}
    }
  }
  throw new Error("Could not resolve app/server from server.js");
};

let app, Product, Category;

beforeAll(async () => {
  await connectToTestDb("products_public_listing_int");

  // register schemas on default connection
  await import("../../../models/productModel.js");
  await import("../../../models/categoryModel.js");

  app = await resolveApp();
  Product = mongoose.model("Product");
  Category = mongoose.model("Category");
});

afterAll(async () => {
  await disconnectFromTestDb();
});

beforeEach(async () => {
  await resetTestDb();
});

/* ------------------------- helpers ------------------------- */
const extractProducts = (body) => {
  if (Array.isArray(body?.products)) return body.products;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body)) return body;
  return [];
};
const extractCount = (body) => {
  if (typeof body?.count === "number") return body.count;
  if (typeof body?.total === "number") return body.total;
  if (typeof body?.productCount === "number") return body.productCount;
  if (typeof body?.totalProducts === "number") return body.totalProducts;
  return undefined;
};

const seedCatalog = async () => {
  const catPhones = await Category.create({ name: "Phones", slug: "phones" });
  const catLaptops = await Category.create({ name: "Laptops", slug: "laptops" });

  // space apart createdAt for deterministic “newest” behavior if route sorts that way
  const base = Date.now();
  const items = [
    { name: "iPhone 14",        slug: "iphone-14",        description: "A phone", price: 799,  quantity: 10, category: catPhones._id, shipping: 1 },
    { name: "iPhone 15 Pro",    slug: "iphone-15-pro",    description: "Best Pro iPhone", price: 1199, quantity: 5,  category: catPhones._id, shipping: 1 },
    { name: "Pixel 8",          slug: "pixel-8",          description: "Google flagship", price: 699,  quantity: 8,  category: catPhones._id, shipping: 1 },
    { name: "Galaxy S23",       slug: "galaxy-s23",       description: "Samsung premium", price: 999,  quantity: 6,  category: catPhones._id, shipping: 1 },
    { name: "MacBook Air M2",   slug: "mba-m2",           description: "Light & fast", price: 1499, quantity: 7,  category: catLaptops._id, shipping: 1 },
    { name: "MacBook Pro 14",   slug: "mbp-14",           description: "Pro power", price: 2199, quantity: 3,  category: catLaptops._id, shipping: 1 },
    { name: "ThinkPad X1",      slug: "thinkpad-x1",      description: "Business classic", price: 1899, quantity: 4,  category: catLaptops._id, shipping: 1 },
    { name: "Surface Laptop 5", slug: "surface-laptop-5", description: "Windows ultraportable", price: 1599, quantity: 2,  category: catLaptops._id, shipping: 1 },
  ].map((p, i) => ({ ...p, createdAt: new Date(base + i * 1000) }));

  await Product.insertMany(items);

  // return a few useful lookups
  const phoneProducts = await Product.find({ category: catPhones._id }).lean();
  const laptopProducts = await Product.find({ category: catLaptops._id }).lean();
  const bySlug = {};
  for (const p of await Product.find({}).lean()) bySlug[p.slug] = p;

  return {
    catPhones: String(catPhones._id),
    catLaptops: String(catLaptops._id),
    phoneProducts,
    laptopProducts,
    bySlug,
    total: items.length,
  };
};

/* ------------------------- tests ------------------------- */
describe("Public Product Listing & Filters", () => {
  it("count matches sum of paginated results", async () => {
    const { total } = await seedCatalog();

    const countRes = await request(app).get("/api/v1/product/product-count");
    expect(countRes.status).toBe(200);
    expect(extractCount(countRes.body)).toBe(total);

    const page1 = await request(app).get("/api/v1/product/product-list/1");
    expect(page1.status).toBe(200);
    const first = extractProducts(page1.body);
    expect(first.length).toBeGreaterThan(0);

    const perPage = first.length; // whatever server uses (often 6)
    const pages = Math.max(1, Math.ceil(total / perPage));

    const ids = new Set(first.map((p) => String(p._id)));
    for (let p = 2; p <= pages; p++) {
      const r = await request(app).get(`/api/v1/product/product-list/${p}`);
      expect(r.status).toBe(200);
      const arr = extractProducts(r.body);
      arr.forEach((it) => ids.add(String(it._id)));
    }
    expect(ids.size).toBe(total);
  });

  it("pagination is capped by perPage and consistent across pages", async () => {
    await seedCatalog();
    const p1 = await request(app).get("/api/v1/product/product-list/1");
    expect(p1.status).toBe(200);
    const first = extractProducts(p1.body);
    expect(first.length).toBeGreaterThan(0);

    const perPage = first.length;
    // Next page should be <= perPage
    const p2 = await request(app).get("/api/v1/product/product-list/2");
    expect(p2.status).toBe(200);
    const second = extractProducts(p2.body);
    expect(second.length).toBeLessThanOrEqual(perPage);
  });

  it("filters by category + price range", async () => {
    const { catPhones } = await seedCatalog();
    const res = await request(app)
      .post("/api/v1/product/product-filters")
      .send({ checked: [catPhones], radio: [700, 1200] })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    const items = extractProducts(res.body);
    expect(items.length).toBeGreaterThan(0);
    for (const p of items) {
      const catId = String(p.category?._id || p.category);
      const price = Number(p.price);
      expect(catId).toBe(catPhones);
      expect(price).toBeGreaterThanOrEqual(700);
      expect(price).toBeLessThanOrEqual(1200);
    }
  });

  it("empty filters returns all", async () => {
    const { total } = await seedCatalog();
    const res = await request(app)
      .post("/api/v1/product/product-filters")
      .send({ checked: [], radio: [] })
      .set("Content-Type", "application/json");
    expect(res.status).toBe(200);
    expect(extractProducts(res.body).length).toBe(total);
  });

  it("price range boundaries are inclusive", async () => {
    const { catPhones, bySlug } = await seedCatalog(); // Pixel 8 = 699, Galaxy S23 = 999 in our seed
    const min = bySlug["pixel-8"].price;  // 699
    const max = bySlug["galaxy-s23"].price; // 999

    const res = await request(app)
      .post("/api/v1/product/product-filters")
      .send({ checked: [catPhones], radio: [min, max] })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    const items = extractProducts(res.body);
    const slugs = new Set(items.map((p) => p.slug));
    expect(slugs.has("pixel-8")).toBe(true);   // boundary min
    expect(slugs.has("galaxy-s23")).toBe(true); // boundary max
  });

  it("page beyond last returns empty array", async () => {
    const { total } = await seedCatalog();
    const first = extractProducts(
      (await request(app).get("/api/v1/product/product-list/1")).body
    );
    const perPage = first.length || 6;
    const pages = Math.max(1, Math.ceil(total / perPage));
    const out = await request(app).get(`/api/v1/product/product-list/${pages + 1}`);
    expect(out.status).toBe(200);
    expect(extractProducts(out.body).length).toBe(0);
  });

  it("get product by slug returns full product object", async () => {
    const { bySlug } = await seedCatalog();
    const slug = "iphone-15-pro";
    const res = await request(app).get(`/api/v1/product/get-product/${slug}`);
    expect(res.status).toBe(200);
    const product = res.body?.product || res.body;
    expect(product).toBeTruthy();
    expect(product.slug).toBe(slug);
    expect(String(product._id)).toBe(String(bySlug[slug]._id));
  });

  it("search by keyword (name / description / slug) returns matches", async () => {
    await seedCatalog();

    // name fragment
    const r1 = await request(app).get("/api/v1/product/search/iphone");
    expect(r1.status).toBe(200);
    const s1 = extractProducts(r1.body);
    expect(s1.length).toBeGreaterThan(0);
    expect(s1.map((p) => p.slug)).toEqual(
      expect.arrayContaining(["iphone-14", "iphone-15-pro"])
    );

    // description fragment
    const r2 = await request(app).get("/api/v1/product/search/ultraportable");
    expect(r2.status).toBe(200);
    const s2 = extractProducts(r2.body);
    expect(s2.map((p) => p.slug)).toEqual(
      expect.arrayContaining(["surface-laptop-5"])
    );

    // slug fragment
    const r3 = await request(app).get("/api/v1/product/search/pixel");
    expect(r3.status).toBe(200);
    const s3 = extractProducts(r3.body);
    expect(s3.map((p) => p.slug)).toEqual(expect.arrayContaining(["pixel-8"]));
  });

  it("related products (same category) exclude the original product", async () => {
    const { phoneProducts, catPhones } = await seedCatalog();
    const target = phoneProducts[0]; // any phone
    const res = await request(app).get(
      `/api/v1/product/related-product/${target._id}/${catPhones}`
    );
    expect(res.status).toBe(200);
    const items = extractProducts(res.body);
    // Ensure none is the same product
    expect(items.find((x) => String(x._id) === String(target._id))).toBeFalsy();
    // Ensure they belong to the same category (if route populates category, handle both shapes)
    for (const p of items) {
      const catId = String(p.category?._id || p.category);
      expect(catId).toBe(catPhones);
    }
  });

  it("filter with invalid category id is handled gracefully (no 5xx)", async () => {
    await seedCatalog();
    const badId = "64bba1c2ff00ff00aa00bbcc"; // not in DB, but valid hex
    const res = await request(app)
      .post("/api/v1/product/product-filters")
      .send({ checked: [badId], radio: [10, 9999] })
      .set("Content-Type", "application/json");

    expect([200, 400]).toContain(res.status); // either “no results” OK or “bad request” OK
    const items = extractProducts(res.body);
    expect(Array.isArray(items)).toBe(true);
  });

  it("product photo endpoint does not error (200 image/* or 404 when none)", async () => {
    const { bySlug } = await seedCatalog();
    const any = bySlug["iphone-14"]; // seeded without photo
    const res = await request(app).get(`/api/v1/product/product-photo/${any._id}`);

    // Implementations differ: many return 404 if no photo, else image/* when present.
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      const ct = String(res.headers["content-type"] || "");
      expect(ct.startsWith("image/")).toBe(true);
    }
  });
});
