// client/src/pages/Product.photo.category.crud.int.test.js
jest.setTimeout(20000);

import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

// Helper to parse binary responses into a Buffer
const parseAsBuffer = (res, cb) => {
  const chunks = [];
  res.on("data", (c) => chunks.push(c));
  res.on("end", () => cb(null, Buffer.concat(chunks)));
};

let app, mongo, Product, Category;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  mongo = await MongoMemoryServer.create();
  process.env.MONGO_URL = mongo.getUri();

  const mod = await import("../../../server.js");
  app = mod.default;

  Product  = (await import("../../../models/productModel.js")).default;
  Category = (await import("../../../models/categoryModel.js")).default;
});

afterAll(async () => {
  await mongoose.connection?.close();
  await mongo.stop();
});

afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});

describe("Product - Photo streaming & Category population", () => {
  it("GET /api/v1/product/product-photo/:pid streams binary with correct content type", async () => {
    const cat = await Category.create({ name: "Cameras", slug: "cameras" });

    const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47]); // "\x89PNG"
    const bodyBytes  = Buffer.from("fakepngdata");
    const photoBuf   = Buffer.concat([pngHeader, bodyBytes]);

    const product = await Product.create({
      name: "Lumix GX9",
      slug: "lumix-gx9",
      description: "Mirrorless camera",
      price: 999,
      quantity: 5,
      category: cat._id,
      shipping: 1,
      photo: { data: photoBuf, contentType: "image/png" },
    });

    const res = await request(app)
      .get(`/api/v1/product/product-photo/${product._id}`)
      .buffer(true)
      .parse(parseAsBuffer);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(photoBuf.length);
    expect(res.body.slice(0, 4).equals(pngHeader)).toBe(true);
  });

  it("GET /api/v1/product/get-product/:slug returns product with POPULATED category {_id, name}", async () => {
    const cat = await Category.create({ name: "Phones", slug: "phones" });

    const product = await Product.create({
      name: "iPhone 15",
      slug: "iphone-15",
      description: "Apple smartphone",
      price: 1399,
      quantity: 10,
      category: cat._id,
      shipping: 1,
    });

    const res = await request(app).get(`/api/v1/product/get-product/${product.slug}`);
    expect(res.status).toBe(200);

    const payload = res.body?.product || res.body;

    expect(payload).toBeTruthy();
    expect(payload.slug).toBe("iphone-15");

    expect(typeof payload.category).toBe("object");
    expect(payload.category).toHaveProperty("_id");
    expect(payload.category).toHaveProperty("name");
    expect(String(payload.category._id)).toBe(String(cat._id));
    expect(payload.category.name).toBe("Phones");
  });

  it("GET /api/v1/product/product-photo/:pid returns 404/400 for valid-but-missing pid", async () => {
    const missingId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .get(`/api/v1/product/product-photo/${missingId}`)
      .buffer(true)
      .parse(parseAsBuffer);

    expect([400, 404]).toContain(res.status);
  });

  it("GET /api/v1/product/get-product/:slug returns 404/400 for unknown slug", async () => {
    const res = await request(app).get(`/api/v1/product/get-product/unknown-slug-xyz`);
    expect([400, 404]).toContain(res.status);
  });

  it("Product with NO photo returns 404/400 (or success:false) on photo endpoint", async () => {
    const cat = await Category.create({ name: "Accessories", slug: "accessories" });
    const product = await Product.create({
      name: "Tripod Lite",
      slug: "tripod-lite",
      description: "Aluminum tripod",
      price: 49,
      quantity: 25,
      category: cat._id,
      shipping: 1,
    });

    const res = await request(app)
      .get(`/api/v1/product/product-photo/${product._id}`)
      .buffer(true)
      .parse(parseAsBuffer);

    const acceptable =
      [400, 404].includes(res.status) ||
      (res.body && res.body.success === false);
    expect(acceptable).toBe(true);
  });

  // ===== New tests you asked for =====

  it("GET /api/v1/product/product-photo/not-an-objectid returns 400 (malformed pid)", async () => {
    const res = await request(app)
      .get(`/api/v1/product/product-photo/not-an-objectid`)
      .buffer(true)
      .parse(parseAsBuffer);

    // Intentionally strict: malformed ObjectId should be handled as 400 (bad request)
    expect(res.status).toBe(400);
  });

  it(
    "GET /api/v1/product/product-photo/:pid streams large binary (≈2MB) without truncation and with correct MIME",
    async () => {
      const cat = await Category.create({ name: "Wallpapers", slug: "wallpapers" });

      // Build a ~2MB buffer (2 * 1024 * 1024 bytes) with a simple repeating pattern
      const size = 2 * 1024 * 1024;
      const largeBuf = Buffer.allocUnsafe(size);
      for (let i = 0; i < size; i++) {
        largeBuf[i] = i % 256;
      }

      const product = await Product.create({
        name: "Large Image",
        slug: "large-image",
        description: "Big binary blob for streaming test",
        price: 1,
        quantity: 1,
        category: cat._id,
        shipping: 0,
        photo: { data: largeBuf, contentType: "image/jpeg" },
      });

      const res = await request(app)
        .get(`/api/v1/product/product-photo/${product._id}`)
        .buffer(true)
        .parse(parseAsBuffer);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toBe("image/jpeg");
      expect(Buffer.isBuffer(res.body)).toBe(true);

      // Must be at least as large; some middlewares may add headers, but body length should match or exceed.
      expect(res.body.length).toBeGreaterThanOrEqual(largeBuf.length);

      // Quick integrity spot-checks (beginning, middle, end)
      expect(res.body[0]).toBe(0);
      expect(res.body[12345]).toBe(12345 % 256);
      expect(res.body[largeBuf.length - 1]).toBe((largeBuf.length - 1) % 256);
    },
    30000 // allow extra time for big buffer serialization
  );
});
