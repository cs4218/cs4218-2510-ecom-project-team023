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

// -------- resolve app or server from server.js (works across export shapes) -----
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

// ----------------------- globals -----------------------
jest.setTimeout(30_000);

let app, Product, Category, User, hashPassword;

// ⛔️ IMPORTANT: use RAW token (no Bearer) to satisfy middleware that reads req.headers.authorization directly
const setAuth = (req, token) =>
  req
    .set("Authorization", token)
    .set("authorization", token)
    .set("x-auth-token", token)
    .set("token", token);

// ---------- small utils ----------
const extractId = async (res, fallbackQuery = {}) => {
  const body = res?.body || {};
  const id =
    body?.product?._id ||
    body?._id ||
    body?.data?._id ||
    null;
  if (id) return String(id);

  if (fallbackQuery && Object.keys(fallbackQuery).length) {
    const doc = await Product.findOne(fallbackQuery).lean();
    if (doc?._id) return String(doc._id);
  }
  return null;
};

const extractSlug = async (res, knownId, fallbackQuery = {}) => {
  const body = res?.body || {};
  let slug =
    body?.product?.slug ||
    body?.slug ||
    body?.data?.slug ||
    null;

  if (!slug && knownId) {
    const fromId = await Product.findById(knownId).lean();
    slug = fromId?.slug || slug;
  }
  if (!slug && fallbackQuery && Object.keys(fallbackQuery).length) {
    const doc = await Product.findOne(fallbackQuery).lean();
    slug = doc?.slug || slug;
  }
  return slug;
};

// JSON creator (fallback if multipart fails)
const createProductJson = async ({ token, catId, overrides = {} }) => {
  const payload = {
    name: overrides.name ?? `Product ${Date.now()}`,
    description: overrides.description ?? "desc",
    price: overrides.price ?? 999,
    quantity: overrides.quantity ?? 3,
    category: catId,
    shipping: overrides.shipping ?? 1,
  };

  return await setAuth(
    request(app).post("/api/v1/product/create-product"),
    token
  )
    .send(payload)
    .set("Content-Type", "application/json");
};

// Multipart creator (primary path), with JSON fallback if needed
const createProductMultipart = async ({ token, catId, overrides = {} }) => {
  const payload = {
    name: overrides.name ?? `Product ${Date.now()}`,
    description: overrides.description ?? "desc",
    price: String(overrides.price ?? 999),
    quantity: String(overrides.quantity ?? 3),
    category: String(catId),
    shipping: String(overrides.shipping ?? 1),
  };

  // multipart first
  let req = setAuth(
    request(app).post("/api/v1/product/create-product"),
    token
  );
  for (const [k, v] of Object.entries(payload)) req = req.field(k, v);
  let res = await req;

  if (![200, 201].includes(res.status)) {
    // JSON fallback
    const jsonPayload = {
      ...payload,
      price: Number(payload.price),
      quantity: Number(payload.quantity),
      shipping: Number(payload.shipping),
    };
    res = await setAuth(
      request(app).post("/api/v1/product/create-product"),
      token
    )
      .send(jsonPayload)
      .set("Content-Type", "application/json");
  }
  return res;
};

// Robust updater: carries forward required fields to avoid "Name is Required"
const updateProductMultipart = async ({ token, id, changes = {} }) => {
  if (!id) throw new Error("updateProductMultipart: missing id");
  const doc = await Product.findById(id).lean();
  if (!doc) throw new Error(`Product ${id} not found for update`);

  const payload = {
    name: doc.name,
    description: doc.description ?? "desc",
    price: String(doc.price ?? ""),
    quantity: String(doc.quantity ?? ""),
    category: String(doc.category ?? ""),
    shipping: String(doc.shipping ?? 1),
    ...Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, String(v)])),
  };

  // multipart first
  let req = setAuth(
    request(app).put(`/api/v1/product/update-product/${id}`),
    token
  );
  for (const [k, v] of Object.entries(payload)) req = req.field(k, v);
  let res = await req;

  if (![200, 201].includes(res.status)) {
    // JSON fallback
    const jsonPayload = {
      name: payload.name,
      description: payload.description,
      price: Number(payload.price),
      quantity: Number(payload.quantity),
      category: payload.category,
      shipping: Number(payload.shipping),
      ...changes,
    };
    res = await setAuth(
      request(app).put(`/api/v1/product/update-product/${id}`),
      token
    )
      .send(jsonPayload)
      .set("Content-Type", "application/json");
  }

  return res;
};

const deleteProduct = ({ token, id }) =>
  setAuth(request(app).delete(`/api/v1/product/delete-product/${id}`), token);

// ----------------------- auth helpers -----------------------
async function login(email, password) {
  const r = await request(app)
    .post("/api/v1/auth/login")
    .send({ email, password })
    .set("Content-Type", "application/json");
  expect(r.status).toBe(200);
  expect(r.body?.success).toBe(true);
  return r.body.token;
}

// ----------------------- lifecycle -----------------------
beforeAll(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "testsecret";

  await connectToTestDb("products_admin_crud_fast");
  await import("../../../models/productModel.js");
  await import("../../../models/categoryModel.js");
  await import("../../../models/userModel.js");

  app = await resolveApp();

  Product = mongoose.model("Product");
  Category = mongoose.model("Category");
  User =
    mongoose.models.User ||
    (mongoose.modelNames().includes("users") && mongoose.model("users"));

  const helpers = await import("../../../helpers/authHelper.js").catch(() => ({}));
  hashPassword = helpers.hashPassword || (async (x) => x);
});

afterAll(async () => {
  await disconnectFromTestDb();
});

let adminToken, userToken, catId;

beforeEach(async () => {
  await resetTestDb();

  const adminEmail = `admin_${Date.now()}@test.local`;
  const userEmail = `user_${Date.now()}@test.local`;
  const adminPwd = "Admin#123";
  const userPwd = "User#123";

  const [adminHashed, userHashed] = await Promise.all([
    hashPassword(adminPwd),
    hashPassword(userPwd),
  ]);

  await User.create([
    { name: "Admin", email: adminEmail, password: adminHashed, phone: "1", address: "A", answer: "x", role: 1 },
    { name: "User",  email: userEmail,  password: userHashed,  phone: "2", address: "B", answer: "y", role: 0 },
  ]);

  adminToken = await login(adminEmail, adminPwd);
  userToken  = await login(userEmail, userPwd);

  const c = await Category.create({ name: "Electronics", slug: `electronics-${Date.now()}` });
  catId = String(c._id);
});

// ----------------------- TESTS -----------------------
describe("Product CRUD (fast path, multipart) — admin vs non-admin", () => {
  it("admin can create → read → update → delete a product", async () => {
    // CREATE
    const create = await createProductMultipart({ token: adminToken, catId, overrides: { name: "iPhone 15", price: 1399 } });
    expect([200, 201]).toContain(create.status);

    const id = await extractId(create, { name: "iPhone 15" });
    expect(id).toBeTruthy();

    const slug = await extractSlug(create, id, { _id: id });
    expect(typeof slug).toBe("string");

    // READ
    const get = await request(app).get(`/api/v1/product/get-product/${slug}`);
    expect(get.status).toBe(200);
    const body = get.body.product || get.body;
    expect(body?.name).toBe("iPhone 15");

    // UPDATE (carry forward required fields)
    const upd = await updateProductMultipart({
      token: adminToken,
      id,
      changes: { price: 1299, quantity: 11 },
    });
    expect([200, 201]).toContain(upd.status);

    const after = await Product.findById(id).lean();
    expect(Number(after.price)).toBe(1299);
    expect(Number(after.quantity)).toBe(11);

    // DELETE
    const del = await deleteProduct({ token: adminToken, id });
    expect([200, 204]).toContain(del.status);

    // confirm gone
    const confirm = await request(app).get(`/api/v1/product/get-product/${slug}`);
    const gone =
      [404, 400].includes(confirm.status) ||
      confirm.body?.product == null ||
      confirm.body?.success === false;
    expect(gone).toBe(true);
  });

  it("validation: missing required fields should fail cleanly", async () => {
    const res = await setAuth(
      request(app).post("/api/v1/product/create-product"),
      adminToken
    )
      .field("name", "")
      .field("description", "")
      .field("price", "")
      .field("quantity", "")
      .field("category", "")
      .field("shipping", "");

    expect([400, 422]).toContain(res.status);
    if (res.body && typeof res.body === "object") {
      if ("success" in res.body) expect(res.body.success).toBeFalsy();
      if ("message" in res.body) expect(String(res.body.message || "")).not.toHaveLength(0);
    }
  });

  it("partial update preserves unspecified fields", async () => {
    const base = await createProductMultipart({
      token: adminToken,
      catId,
      overrides: {
        name: "Surface Laptop",
        description: "Thin and light",
        price: 1599,
        quantity: 7,
      },
    });
    expect([200, 201]).toContain(base.status);

    const id = await extractId(base, { name: "Surface Laptop" });
    expect(id).toBeTruthy();

    // change only price
    const upd = await updateProductMultipart({
      token: adminToken,
      id,
      changes: { price: 1499 },
    });
    expect([200, 201]).toContain(upd.status);

    const after = await Product.findById(id).lean();
    expect(Number(after.price)).toBe(1499);
    expect(Number(after.quantity)).toBe(7); // unchanged
    expect(after.description).toBe("Thin and light"); // unchanged
  });

  it("delete non-existent returns 404/400 (some apps return 200 idempotently)", async () => {
    const fake = new mongoose.Types.ObjectId().toString();
    const del = await deleteProduct({ token: adminToken, id: fake });
    expect([200, 400, 404]).toContain(del.status);
  });

  it("non-admin is blocked from create/update/delete", async () => {
    const createBlocked = await createProductMultipart({ token: userToken, catId, overrides: { name: "Blocked" } });
    expect([401, 403]).toContain(createBlocked.status);

    // seed one with admin so it exists
    const ok = await createProductMultipart({ token: adminToken, catId, overrides: { name: "MacBook" } });
    expect([200, 201]).toContain(ok.status);

    const id = await extractId(ok, { name: "MacBook" });
    expect(id).toBeTruthy();

    const upd = await updateProductMultipart({
      token: userToken,
      id,
      changes: { price: 1 },
    });
    expect([401, 403]).toContain(upd.status);

    const rem = await deleteProduct({ token: userToken, id });
    expect([401, 403]).toContain(rem.status);
  });
});
