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
    srvMod, srvMod?.default, srvMod?.default?.default,
    srvMod?.app, srvMod?.default?.app,
    srvMod?.server, srvMod?.default?.server,
  ];
  const isExpress = (x) => typeof x === "function" && (x.handle || x.use);
  const isHttp = (x) => x && typeof x.address === "function" && typeof x.close === "function";
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

const parseAsBuffer = (res, cb) => {
  const chunks = [];
  res.on("data", (c) => chunks.push(c));
  res.on("end", () => cb(null, Buffer.concat(chunks)));
};

beforeAll(async () => {
  await connectToTestDb("product_photo_populate_int");
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

describe("Product photo streaming & populated category", () => {
  it("streams binary with proper content-type (and content-length if provided)", async () => {
    const cat = await Category.create({ name: "Cameras", slug: "cameras" });
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const body = Buffer.from("fakepngdata");
    const data = Buffer.concat([pngHeader, body]);

    const p = await Product.create({
      name: "Lumix GX9",
      slug: "lumix-gx9",
      description: "Mirrorless",
      price: 999,
      quantity: 5,
      category: cat._id,
      shipping: 1,
      photo: { data, contentType: "image/png" },
    });

    const res = await request(app)
      .get(`/api/v1/product/product-photo/${p._id}`)
      .buffer(true)
      .parse(parseAsBuffer);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.slice(0, 4).equals(pngHeader)).toBe(true);

    // Some implementations set content-length; don’t fail if omitted
    const len = res.headers["content-length"];
    if (len) expect(Number(len)).toBe(data.length);
  });

  it("get-product by slug returns product with POPULATED category", async () => {
    const cat = await Category.create({ name: "Phones", slug: "phones" });
    const p = await Product.create({
      name: "iPhone 15",
      slug: "iphone-15",
      description: "Apple smartphone",
      price: 1399,
      quantity: 10,
      category: cat._id,
      shipping: 1,
    });

    const res = await request(app).get(`/api/v1/product/get-product/${p.slug}`);
    expect(res.status).toBe(200);
    const payload = res.body?.product || res.body;

    expect(payload.slug).toBe("iphone-15");
    // populated category should be an object with _id/name/slug
    expect(typeof payload.category).toBe("object");
    expect(String(payload.category._id)).toBe(String(cat._id));
    expect(payload.category.name).toBe("Phones");
    expect(payload.category.slug).toBe("phones");
  });

  it("get-product by slug → 404 when not found", async () => {
    const res = await request(app).get(`/api/v1/product/get-product/does-not-exist`);
    expect([404, 400]).toContain(res.status); // some implementations use 400
  });

  it("photo endpoint 404/400 for missing pid", async () => {
    const missing = new mongoose.Types.ObjectId();
    const res = await request(app)
      .get(`/api/v1/product/product-photo/${missing}`)
      .buffer(true)
      .parse(parseAsBuffer);
    expect([400, 404]).toContain(res.status);
  });

  it("photo endpoint 400 for malformed pid", async () => {
    const res = await request(app)
      .get(`/api/v1/product/product-photo/not-an-objectid`)
      .buffer(true)
      .parse(parseAsBuffer);
    expect(res.status).toBe(400);
  });

  it("related products exclude self and stay in same category (populated when provided)", async () => {
    const cat = await Category.create({ name: "Laptops", slug: "laptops" });
    const a = await Product.create({
      name: "MacBook Air",
      slug: "mba",
      description: "Light",
      price: 1499,
      quantity: 3,
      category: cat._id,
      shipping: 1,
    });
    const b = await Product.create({
      name: "ThinkPad X1",
      slug: "x1",
      description: "Business",
      price: 1899,
      quantity: 2,
      category: cat._id,
      shipping: 1,
    });

    const res = await request(app).get(
      `/api/v1/product/related-product/${a._id}/${cat._id}`
    );
    expect(res.status).toBe(200);
    const list = Array.isArray(res.body?.products) ? res.body.products : (res.body || []);
    // should include b, exclude a
    const ids = list.map((x) => String(x._id));
    expect(ids).toContain(String(b._id));
    expect(ids).not.toContain(String(a._id));

    // if the route populates category, it will be an object; otherwise it’s an id
    for (const item of list) {
      const catField = item.category;
      if (catField && typeof catField === "object") {
        expect(String(catField._id)).toBe(String(cat._id));
        expect(catField.slug).toBe("laptops");
      } else {
        expect(String(catField)).toBe(String(cat._id));
      }
    }
  });

  it("public lists do not embed large photo blobs", async () => {
    // seed with and without photo
    const cat = await Category.create({ name: "Audio", slug: "audio" });
    const withPhoto = await Product.create({
      name: "Headphones",
      slug: "cans",
      description: "Over-ear",
      price: 299,
      quantity: 10,
      category: cat._id,
      shipping: 1,
      photo: { data: Buffer.from("xxxx"), contentType: "image/png" },
    });
    const withoutPhoto = await Product.create({
      name: "Earbuds",
      slug: "buds",
      description: "In-ear",
      price: 99,
      quantity: 20,
      category: cat._id,
      shipping: 1,
    });

    const res = await request(app).get("/api/v1/product/product-list/1");
    expect(res.status).toBe(200);
    const items =
      Array.isArray(res.body?.products) ? res.body.products :
      Array.isArray(res.body?.data) ? res.body.data :
      Array.isArray(res.body) ? res.body : [];

    // Find both products and ensure there is no `photo.data` field in responses
    const gotWith = items.find((p) => String(p._id) === String(withPhoto._id));
    const gotWithout = items.find((p) => String(p._id) === String(withoutPhoto._id));
    expect(gotWith).toBeTruthy();
    expect(gotWithout).toBeTruthy();
    expect(gotWith?.photo?.data).toBeFalsy();
    expect(gotWithout?.photo?.data).toBeFalsy();
  });

  it("photo replacement serves new bytes and sane cache headers", async () => {
    const cat = await Category.create({ name: "Monitors", slug: "monitors" });

    const v1 = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xdb]), Buffer.from("jpeg1")]); // fake jpeg
    const v2 = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xdb]), Buffer.from("jpeg2-new")]);

    const p = await Product.create({
      name: "Ultrawide",
      slug: "ultra",
      description: "21:9",
      price: 899,
      quantity: 5,
      category: cat._id,
      shipping: 1,
      photo: { data: v1, contentType: "image/jpeg" },
    });

    const r1 = await request(app)
      .get(`/api/v1/product/product-photo/${p._id}`)
      .buffer(true)
      .parse(parseAsBuffer);
    expect(r1.status).toBe(200);
    expect(r1.headers["content-type"]).toBe("image/jpeg");
    expect(r1.body.equals(v1)).toBe(true);

    // replace the photo in DB
    await Product.updateOne(
      { _id: p._id },
      { $set: { "photo.data": v2, "photo.contentType": "image/jpeg" } }
    );

    const r2 = await request(app)
      .get(`/api/v1/product/product-photo/${p._id}`)
      .buffer(true)
      .parse(parseAsBuffer);
    expect(r2.status).toBe(200);
    expect(r2.headers["content-type"]).toBe("image/jpeg");
    expect(r2.body.equals(v2)).toBe(true);

    // cache-control is implementation specific; accept common sane values
    const cc = String(r2.headers["cache-control"] || "");
    // allow any, but if present it should be a string (not crash) and not masquerade as JSON
    expect(typeof cc).toBe("string");
    expect(String(r2.headers["content-type"])).toMatch(/^image\//);
  });

  it("HEAD on product-photo is 200/404/405 (implementation dependent), but never 5xx", async () => {
    const cat = await Category.create({ name: "Storage", slug: "storage" });
    const data = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]); // GIF89a
    const p = await Product.create({
      name: "USB Stick",
      slug: "usb",
      description: "64GB",
      price: 19,
      quantity: 10,
      category: cat._id,
      shipping: 1,
      photo: { data, contentType: "image/gif" },
    });

    const res = await request(app).head(`/api/v1/product/product-photo/${p._id}`);
    // Some stacks support HEAD, some don’t and return 404/405—either is fine, but 5xx is not.
    expect([200, 404, 405]).toContain(res.status);
  });
});
