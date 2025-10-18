/**
 * @jest-environment node
 */
// client/src/pages/admin/AdminDashboard-AdminMenu.integration.test.js

import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

// Force server.js to connect to our in-memory Mongo
jest.mock(require.resolve("../../../../config/db.js"), () => ({
  __esModule: true,
  default: async () => {
    const m = (await import("mongoose")).default;
    await m.connect(process.env.MONGO_URL, { dbName: "ecom_admin_int" });
  },
}));

let app, mongod, User, Order, Product, Category, hashPassword;

// --- helpers ---
function withToken(req, token) {
  return req
    .set("Authorization", token)
    .set("authorization", token)
    .set("Cookie", [`token=${token}`]);
}

async function loginAndGetToken(email, password) {
  const res = await request(app)
    .post("/api/v1/auth/login")
    .send({ email, password })
    .set("Content-Type", "application/json");

  if (!res.body?.success) {
    // eslint-disable-next-line no-console
    console.error("LOGIN FAIL", email, res.status, res.body);
  }
  expect(res.status).toBe(200);
  expect(res.body?.success).toBe(true);
  return res.body.token;
}

const adminEmail = "admin@test.local";
const userEmail = "user@test.local";
const adminPwd = "Admin#123";
const userPwd = "User#123";
const getId = (val) =>
  val && typeof val === "object" ? String(val._id || val.id) : String(val);

// Resolve Express app/http.Server exported by server.js
const resolveApp = async () => {
  const srvMod = await import("../../../../server.js");
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
  throw new Error("Could not resolve Express app/http.Server from server.js");
};

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URL = mongod.getUri();

  // Clear precompiled models across projects / watch runs
  if (typeof mongoose.deleteModel === "function") {
    for (const name of ["User", "users", "Order", "orders", "Product", "products", "Category", "categories"]) {
      try {
        mongoose.deleteModel(name);
      } catch {}
    }
  } else {
    delete mongoose.models.User;
    delete mongoose.models.users;
    delete mongoose.models.Order;
    delete mongoose.models.orders;
    delete mongoose.models.Product;
    delete mongoose.models.products;
    delete mongoose.models.Category;
    delete mongoose.models.categories;
  }

  // Register schemas (IMPORTANT: include Order!)
  await import("../../../../models/userModel.js");
  await import("../../../../models/orderModel.js");
  await import("../../../../models/productModel.js");
  await import("../../../../models/categoryModel.js");

  // Resolve app after models are registered
  app = await resolveApp();

  // Pull compiled models (defensive against pluralization)
  User = mongoose.models.User
    ? mongoose.model("User")
    : (mongoose.models.users ? mongoose.model("users") : undefined);

  Order = mongoose.models.Order
    ? mongoose.model("Order")
    : (mongoose.models.orders ? mongoose.model("orders") : undefined);

  Product = mongoose.models.Product
    ? mongoose.model("Product")
    : (mongoose.models.products ? mongoose.model("products") : undefined);

  Category = mongoose.models.Category
    ? mongoose.model("Category")
    : (mongoose.models.categories ? mongoose.model("categories") : undefined);

  if (!User || !Order || !Product || !Category) {
    throw new Error(`Models missing. Available: ${Object.keys(mongoose.models).join(", ")}`);
  }

  // Optional helper import (hashPassword)
  const helpers = await import("../../../../helpers/authHelper.js").catch(() => ({}));
  hashPassword = helpers.hashPassword || (async (x) => x);
});

afterAll(async () => {
  if (mongoose.connection.readyState) await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});

// --------- Tests mapping Admin Dashboard needs ---------
describe("Admin Dashboard integration via auth routes (Sandwich)", () => {
  let adminToken, userToken, userId, adminId, orderId, productId;

  beforeEach(async () => {
    // Seed users
    const [adminHashed, userHashed] = await Promise.all([
      hashPassword(adminPwd),
      hashPassword(userPwd),
    ]);

    const [adminDoc, userDoc] = await User.create([
      {
        name: "Admin Tester",
        email: adminEmail,
        password: adminHashed,
        phone: "00000000",
        address: "Nowhere",
        answer: "x",
        role: 1,
      },
      {
        name: "Normal Tester",
        email: userEmail,
        password: userHashed,
        phone: "11111111",
        address: "Somewhere",
        answer: "y",
        role: 0,
      },
    ]);

    adminId = String(adminDoc._id);
    userId = String(userDoc._id);

    // Log in
    adminToken = await loginAndGetToken(adminEmail, adminPwd);
    userToken = await loginAndGetToken(userEmail, userPwd);

    // Seed category/product
    const cat = await Category.create({ name: "Electronics", slug: "electronics" });
    const prod = await Product.create({
      name: "Widget",
      slug: "widget",
      description: "A test widget",
      price: 99,
      category: cat._id,
      quantity: 10, // product stock, not order line quantity
      shipping: 1,
    });
    productId = String(prod._id);

    // One order for the normal user
    const ord = await Order.create({
      products: [prod._id], // array of ObjectId(s) per schema
      payment: { id: "BRAIN-FAKE", status: "captured", amount: 198 },
      buyer: userId,
    });
    orderId = String(ord._id);

    // And one order for someone else (admin) so filtering is meaningful
    await Order.create({
      products: [prod._id],
      payment: { id: "BRAIN-FAKE-2", status: "captured", amount: 99 },
      buyer: adminId,
    });
  });

  it("admin-auth: admin token passes, user token blocked", async () => {
    const adminRes = await withToken(request(app).get("/api/v1/auth/admin-auth"), adminToken);
    expect(adminRes.status).toBe(200);
    expect(adminRes.body?.ok).toBe(true);

    const userRes = await withToken(request(app).get("/api/v1/auth/admin-auth"), userToken);
    expect([401, 403]).toContain(userRes.status);
  });

  it("users: admin can list users, non-admin forbidden", async () => {
    const adminRes = await withToken(request(app).get("/api/v1/auth/users"), adminToken);
    expect(adminRes.status).toBe(200);
    const list = adminRes.body?.users || adminRes.body || [];
    expect(Array.isArray(list)).toBe(true);
    const emails = list.map((u) => u.email);
    expect(emails).toEqual(expect.arrayContaining([adminEmail, userEmail]));

    const userRes = await withToken(request(app).get("/api/v1/auth/users"), userToken);
    expect([401, 403]).toContain(userRes.status);
  });

  it("orders: user sees only their orders", async () => {
    const res = await withToken(request(app).get("/api/v1/auth/orders"), userToken);
    expect(res.status).toBe(200);

    const orders = res.body?.orders ?? res.body ?? [];
    expect(Array.isArray(orders)).toBe(true);
    expect(orders).toHaveLength(1); // proves filtering (DB has 2 orders)

    const [order] = orders;
    expect(String(order?.buyer?._id ?? order?.buyer)).toBe(userId);

    // Products array exists and contains our product
    expect(Array.isArray(order.products)).toBe(true);
    expect(order.products.length).toBe(1);
    const maybePopulated = order.products[0];
    const seenProductId = String(maybePopulated?._id ?? maybePopulated);
    expect(seenProductId).toBe(productId);

    // No quantity assertion here — not part of your Order schema
  });

  it("all-orders: admin sees all orders, includes buyer + product refs", async () => {
    const res = await withToken(request(app).get("/api/v1/auth/all-orders"), adminToken);
    expect(res.status).toBe(200);

    const orders = res.body?.orders ?? res.body ?? [];
    expect(Array.isArray(orders)).toBe(true);
    expect(orders.length).toBe(2);

    const buyers = orders.map((o) => String(o?.buyer?._id ?? o?.buyer));
    expect(buyers).toEqual(expect.arrayContaining([userId, adminId]));
  });

  it("order-status: admin updates status and change persists", async () => {
    const upd = await withToken(
      request(app).put(`/api/v1/auth/order-status/${orderId}`).send({ status: "Shipped" }),
      adminToken
    ).set("Content-Type", "application/json");

    expect([200, 201]).toContain(upd.status);

    const check = await Order.findById(orderId).lean();
    expect(check?.status).toBe("Shipped");
  });

  it("order-status: non-admin forbidden", async () => {
    const upd = await withToken(
      request(app).put(`/api/v1/auth/order-status/${orderId}`).send({ status: "Delivered" }),
      userToken
    ).set("Content-Type", "application/json");

    expect([401, 403]).toContain(upd.status);
  });
});
