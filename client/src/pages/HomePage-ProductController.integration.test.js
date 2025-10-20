jest.setTimeout(30000);

import request from "supertest";
import mongoose from "mongoose";

// Real app + real test DB helpers
import app from "../../../server.js";
import {
  connectToTestDb,
  resetTestDb,
  disconnectFromTestDb,
} from "../../../config/testdb.js";

// Ensure models are registered on the default mongoose connection
import "../../../models/productModel.js";
import "../../../models/categoryModel.js";

let Product, Category;

beforeAll(async () => {
  process.env.NODE_ENV = "test"; // ensure server.js doesn't auto-connect elsewhere
  await connectToTestDb("frontend-homepage-products");
  Product = mongoose.model("Product");
  Category = mongoose.model("Category");
});

afterAll(async () => {
  await disconnectFromTestDb();
});

beforeEach(async () => {
  await resetTestDb();
});

// ---------- helpers ----------
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
  const catA = await Category.create({ name: "Phones", slug: "phones" });
  const catB = await Category.create({ name: "Laptops", slug: "laptops" });

  let items = [
    { name: "iPhone 14",        slug: "iphone-14",        description: "A", price: 799,  quantity: 10, category: catA._id, shipping: 1 },
    { name: "iPhone 15 Pro",    slug: "iphone-15-pro",    description: "A", price: 1199, quantity: 5,  category: catA._id, shipping: 1 },
    { name: "Pixel 8",          slug: "pixel-8",          description: "A", price: 699,  quantity: 8,  category: catA._id, shipping: 1 },
    { name: "Galaxy S23",       slug: "galaxy-s23",       description: "A", price: 999,  quantity: 6,  category: catA._id, shipping: 1 },
    { name: "MacBook Air M2",   slug: "mba-m2",           description: "B", price: 1499, quantity: 7,  category: catB._id, shipping: 1 },
    { name: "MacBook Pro 14",   slug: "mbp-14",           description: "B", price: 2199, quantity: 3,  category: catB._id, shipping: 1 },
    { name: "ThinkPad X1",      slug: "thinkpad-x1",      description: "B", price: 1899, quantity: 4,  category: catB._id, shipping: 1 },
    { name: "Surface Laptop 5", slug: "surface-laptop-5", description: "B", price: 1599, quantity: 2,  category: catB._id, shipping: 1 },
  ];

  // Stabilize server-side sorting: unique createdAt per doc
  const base = Date.now();
  items = items.map((p, i) => ({ ...p, createdAt: new Date(base + i * 1000) }));

  await Product.insertMany(items);
  return { catA: String(catA._id), catB: String(catB._id), total: items.length };
};

// ---------- tests ----------
describe("HomePage ↔ ProductController (public endpoints)", () => {
  it("product-count matches total inserted", async () => {
    const { total } = await seedCatalog();

    const countRes = await request(app).get("/api/v1/product/product-count");
    expect(countRes.status).toBe(200);
    const reported = extractCount(countRes.body);
    expect(typeof reported).toBe("number");
    expect(reported).toBe(total);
  });

  it("product-list paginates and overall union equals total", async () => {
    const { total } = await seedCatalog();

    // Crawl pages until empty, union all IDs
    const ids = new Set();
    const safetyCap = 50; // prevents infinite loop on server bug
    for (let page = 1; page <= safetyCap; page++) {
      const r = await request(app).get(`/api/v1/product/product-list/${page}`);
      expect(r.status).toBe(200);
      const arr = extractProducts(r.body);
      if (!arr.length) break; // last page reached
      arr.forEach((item) => ids.add(String(item._id)));
    }

    // Compare with DB and the count endpoint
    const realCount = await Product.countDocuments({});
    expect(ids.size).toBe(realCount);
    const countRes = await request(app).get("/api/v1/product/product-count");
    const reported = extractCount(countRes.body);
    expect(ids.size).toBe(reported);
    expect(reported).toBe(total);
  });

  it("product-filters returns items in category & within price range", async () => {
    const { catA } = await seedCatalog();

    const res = await request(app)
      .post("/api/v1/product/product-filters")
      .send({ checked: [catA], radio: [700, 1200] })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    const products = extractProducts(res.body);
    expect(Array.isArray(products)).toBe(true);
    expect(products.length).toBeGreaterThan(0);

    for (const p of products) {
      const price = Number(p.price);
      const catId = String(p.category?._id || p.category);
      expect(catId).toBe(catA);
      expect(price).toBeGreaterThanOrEqual(700);
      expect(price).toBeLessThanOrEqual(1200);
    }

    const names = products.map((p) => p.name);
    expect(names).not.toContain("Pixel 8"); // 699 < 700
  });

  it("product-list beyond last page returns empty array", async () => {
    const { total } = await seedCatalog();

    const first = await request(app).get("/api/v1/product/product-list/1");
    expect(first.status).toBe(200);
    const firstArr = extractProducts(first.body);
    const perPage = firstArr.length || 6;
    const pages = Math.max(1, Math.ceil(total / perPage));

    const out = await request(app).get(`/api/v1/product/product-list/${pages + 1}`);
    expect(out.status).toBe(200);
    const arr = extractProducts(out.body);
    expect(Array.isArray(arr)).toBe(true);
    expect(arr.length).toBe(0);
  });

  it("Each paginated item has minimal shape (_id, name, price, category)", async () => {
    await seedCatalog();
    const r = await request(app).get("/api/v1/product/product-list/1");
    expect(r.status).toBe(200);
    const items = extractProducts(r.body);
    expect(items.length).toBeGreaterThan(0);

    for (const p of items) {
      expect(p).toHaveProperty("_id");
      expect(p).toHaveProperty("name");
      expect(p).toHaveProperty("price");
      expect(p).toHaveProperty("category");
    }
  });

  it("Filter by multiple categories returns only those categories within range", async () => {
    const { catA, catB } = await seedCatalog();

    const res = await request(app)
      .post("/api/v1/product/product-filters")
      .send({ checked: [catA, catB], radio: [800, 2000] })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    const products = extractProducts(res.body);
    expect(products.length).toBeGreaterThan(0);

    const allowed = new Set([catA, catB]);
    for (const p of products) {
      const price = Number(p.price);
      const catId = String(p.category?._id || p.category);
      expect(allowed.has(catId)).toBe(true);
      expect(price).toBeGreaterThanOrEqual(800);
      expect(price).toBeLessThanOrEqual(2000);
    }
  });

  it("Filter by price only (no categories) returns items in range across categories", async () => {
    await seedCatalog();
    const res = await request(app)
      .post("/api/v1/product/product-filters")
      .send({ checked: [], radio: [1500, 2500] })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    const products = extractProducts(res.body);
    expect(products.length).toBeGreaterThan(0);

    for (const p of products) {
      const price = Number(p.price);
      expect(price).toBeGreaterThanOrEqual(1500);
      expect(price).toBeLessThanOrEqual(2500);
    }
  });

  it("Filter by categories only (no price) returns all items from those categories", async () => {
    const { catA } = await seedCatalog();
    const res = await request(app)
      .post("/api/v1/product/product-filters")
      .send({ checked: [catA], radio: [] })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    const products = extractProducts(res.body);
    expect(products.length).toBeGreaterThan(0);

    for (const p of products) {
      const catId = String(p.category?._id || p.category);
      expect(catId).toBe(catA);
    }
  });
});
