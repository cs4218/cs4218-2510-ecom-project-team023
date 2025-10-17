/**
 * @jest-environment node
 */
// setup written with help from ChatGPT
jest.setTimeout(30000);

import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

// ---- Force server.js to connect to the in-memory DB ----
jest.mock(require.resolve("../../../config/db.js"), () => ({
  __esModule: true,
  default: async () => {
    const m = (await import("mongoose")).default;
    await m.connect(process.env.MONGO_URL, { dbName: "ecom_frontend_int" });
  },
}));

let app, mongod, Product, Category;

// Resolve Express app or http.Server regardless of export style
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
    if (typeof c === "function" && !c.handle && !c.address) {
      try {
        const maybe = c();
        if (isExpress(maybe) || isHttp(maybe)) return maybe;
        if (maybe?.app && isExpress(maybe.app)) return maybe.app;
        if (maybe?.server && isHttp(maybe.server)) return maybe.server;
      } catch {}
    }
  }
  throw new Error("Could not resolve Express app/http.Server from server.js");
};

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

  const items = [
    { name: "iPhone 14",        slug: "iphone-14",        description: "A", price: 799,  quantity: 10, category: catA._id, shipping: 1 },
    { name: "iPhone 15 Pro",    slug: "iphone-15-pro",    description: "A", price: 1199, quantity: 5,  category: catA._id, shipping: 1 },
    { name: "Pixel 8",          slug: "pixel-8",          description: "A", price: 699,  quantity: 8,  category: catA._id, shipping: 1 },
    { name: "Galaxy S23",       slug: "galaxy-s23",       description: "A", price: 999,  quantity: 6,  category: catA._id, shipping: 1 },
    { name: "MacBook Air M2",   slug: "mba-m2",           description: "B", price: 1499, quantity: 7,  category: catB._id, shipping: 1 },
    { name: "MacBook Pro 14",   slug: "mbp-14",           description: "B", price: 2199, quantity: 3,  category: catB._id, shipping: 1 },
    { name: "ThinkPad X1",      slug: "thinkpad-x1",      description: "B", price: 1899, quantity: 4,  category: catB._id, shipping: 1 },
    { name: "Surface Laptop 5", slug: "surface-laptop-5", description: "B", price: 1599, quantity: 2,  category: catB._id, shipping: 1 },
  ];
  await Product.insertMany(items);
  return { catA: String(catA._id), catB: String(catB._id), total: items.length };
};

beforeAll(async () => {
  process.env.NODE_ENV = "test";

  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URL = mongod.getUri();

  // Clear any precompiled models across projects
  if (typeof mongoose.deleteModel === "function") {
    for (const name of ["Product", "Category", "Order", "orders", "User", "users"]) {
      try { mongoose.deleteModel(name); } catch {}
    }
  } else {
    delete mongoose.models.Product;
    delete mongoose.models.Category;
    delete mongoose.models.Order;
    delete mongoose.models.orders;
    delete mongoose.models.User;
    delete mongoose.models.users;
  }

  // Register schemas used by HomePage
  await import("../../../models/categoryModel.js");
  await import("../../../models/productModel.js");

  // Resolve the app/server after models are registered
  app = await resolveApp();

  // Pull compiled models
  Product = mongoose.model("Product");
  Category = mongoose.model("Category");
});

afterAll(async () => {
  if (mongoose.connection.readyState) await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});

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

    const countRes = await request(app).get("/api/v1/product/product-count");
    const reported = extractCount(countRes.body);
    expect(reported).toBe(total);

    const page1 = await request(app).get("/api/v1/product/product-list/1");
    expect(page1.status).toBe(200);
    const first = extractProducts(page1.body);
    expect(first.length).toBeGreaterThan(0);

    const perPage = first.length;
    const pages = Math.max(1, Math.ceil(reported / perPage));

    const ids = new Set(first.map((p) => String(p._id)));
    for (let p = 2; p <= pages; p++) {
      const r = await request(app).get(`/api/v1/product/product-list/${p}`);
      expect(r.status).toBe(200);
      const arr = extractProducts(r.body);
      arr.forEach((item) => ids.add(String(item._id)));
      if (p < pages) expect(arr.length).toBeLessThanOrEqual(perPage);
    }
    expect(ids.size).toBe(reported);
  });

  it("product-filters returns items in category & within price range", async () => {
    const { catA } = await seedCatalog();

    const res = await request(app)
      .post("/api/v1/product/product-filters")
      .send({ checked: [catA], radio: [700, 1200] })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    const products = extractProducts(res.body);
    expect(products.length).toBeGreaterThan(0);

    for (const p of products) {
      const price = Number(p.price);
      const catId = String(p.category?._id || p.category);
      expect(catId).toBe(catA);
      expect(price).toBeGreaterThanOrEqual(700);
      expect(price).toBeLessThanOrEqual(1200);
    }
  });

  it("product-list beyond last page returns empty array", async () => {
    const { total } = await seedCatalog();

    const page1 = await request(app).get("/api/v1/product/product-list/1");
    const first = extractProducts(page1.body);
    const perPage = first.length || 6;
    const pages = Math.max(1, Math.ceil(total / perPage));

    const out = await request(app).get(`/api/v1/product/product-list/${pages + 1}`);
    expect(out.status).toBe(200);
    const arr = extractProducts(out.body);
    expect(arr.length).toBe(0);
  });
});
