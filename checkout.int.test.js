// setup written with help from ChatGPT
import jwt from "jsonwebtoken";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";

// ---- Mock DB connector exactly as server.js imports it -----------------
jest.mock(require.resolve("./config/db.js"), () => ({
  __esModule: true,
  default: async () => {
    const mongooseMod = (await import("mongoose")).default;
    const uri = process.env.MONGO_URL;
    await mongooseMod.connect(uri, { dbName: "ecom_int_test" });
  },
}));

// ---- Mock Braintree in the shape the app expects -----------------------
const mockBtSale = jest.fn((payload, cb) =>
  cb(null, {
    success: true,
    transaction: {
      id: "txn_123",
      status: "submitted_for_settlement",
      amount: String(payload?.amount ?? "0"),
    },
  })
);

jest.mock("braintree", () => {
  class BraintreeGateway {
    constructor() {
      this.transaction = { sale: (...args) => mockBtSale(...args) };
      this.clientToken = { generate: (_opts, cb) => cb(null, { clientToken: "tok_abc" }) };
    }
  }
  const Environment = { Sandbox: "Sandbox" };
  return { __esModule: true, default: { BraintreeGateway, Environment }, BraintreeGateway, Environment };
});

// ---------- Globals ----------
let app;       // Express app function or http.Server
let mongod;    // MongoMemoryServer
let Product;   // Mongoose Model ("Product")
let Order;     // Mongoose Model ("Order" or "orders")

// ---------- Helpers ----------
const makeJwt = (userId) =>
  jwt.sign({ _id: userId, role: 0, name: "Test Buyer" }, process.env.JWT_SECRET || "testsecret");

const authHeader = (token) => ({ Authorization: token });

const seedProducts = async (mongoose) => {
  const p1 = await Product.create({
    name: "Laptop",
    slug: "laptop",
    description: "Powerful laptop",
    price: 1500,
    category: new mongoose.Types.ObjectId(),
    quantity: 10,
    shipping: true,
  });
  const p2 = await Product.create({
    name: "Mouse",
    slug: "mouse",
    description: "Wireless mouse",
    price: 25,
    category: new mongoose.Types.ObjectId(),
    quantity: 7,
    shipping: true,
  });
  return { p1, p2 };
};

describe("Checkout Integration • Product → Payment → Stock & Order", () => {
  beforeAll(async () => {
    // 0) Spin up DB + env
    mongod = await MongoMemoryServer.create();
    process.env.MONGO_URL = mongod.getUri();
    process.env.JWT_SECRET = process.env.JWT_SECRET || "testsecret";

    // 1) Mongoose handle
    const mongooseMod = (await import("mongoose")).default;

    // 2) Clear any precompiled models BEFORE importing anything that might register them
    if (typeof mongooseMod.deleteModel === "function") {
      try { mongooseMod.deleteModel("Product"); } catch {}
      try { mongooseMod.deleteModel("Order"); } catch {}
      try { mongooseMod.deleteModel("orders"); } catch {}
    } else {
      delete mongooseMod.models.Product;
      delete mongooseMod.models.Order;
      delete mongooseMod.models.orders;
    }

    // 3) Explicitly import model files so they register on default connection
    const productPath = require.resolve("./models/productModel.js");
    const orderPath   = require.resolve("./models/orderModel.js");
    await import(productPath);
    await import(orderPath);

    // 4) Import app robustly (works with default/app/server/factory/nested-default)
    const srvMod = await import("./server.js");
    const candidates = [
      srvMod,
      srvMod?.default,
      srvMod?.default?.default,
      srvMod?.app,
      srvMod?.server,
      srvMod?.default?.app,
      srvMod?.default?.server,
    ];
    const looksLikeExpressApp = (x) =>
      typeof x === "function" && (typeof x.handle === "function" || typeof x.use === "function");
    const looksLikeHttpServer = (x) =>
      x && typeof x.address === "function" && typeof x.close === "function";

    let appOrServer;
    for (const c of candidates) {
      if (!c) continue;

      if (looksLikeExpressApp(c) || looksLikeHttpServer(c)) {
        appOrServer = c; break;
      }
      if (c && typeof c.app === "function" && (c.app.handle || c.app.use)) {
        appOrServer = c.app; break;
      }
      if (c && c.server && looksLikeHttpServer(c.server)) {
        appOrServer = c.server; break;
      }
      if (typeof c === "function" && !c.handle && !c.address) {
        try {
          const maybe = c();
          if (looksLikeExpressApp(maybe) || looksLikeHttpServer(maybe)) { appOrServer = maybe; break; }
          if (maybe?.app && (maybe.app.handle || maybe.app.use)) { appOrServer = maybe.app; break; }
          if (maybe?.server && looksLikeHttpServer(maybe.server)) { appOrServer = maybe.server; break; }
        } catch { /* ignore */ }
      }
    }
    if (!appOrServer) {
      const keys1 = Object.keys(srvMod || {});
      const keys2 = Object.keys((srvMod && srvMod.default) || {});
      const keys3 = Object.keys((srvMod && srvMod.default && srvMod.default.default) || {});
      throw new Error(
        `server.js did not export an Express app or http.Server. ` +
        `Top-level keys=${keys1}; default keys=${keys2}; default.default keys=${keys3}`
      );
    }
    app = appOrServer;

    // 5) Fetch compiled models by name
    Product = mongooseMod.model("Product");
    Order = mongooseMod.models.Order ? mongooseMod.model("Order") : mongooseMod.model("orders");

    // 6) Sanity checks
    if (typeof Product.create !== "function" || typeof Product.deleteMany !== "function") {
      throw new Error("Product is not a Mongoose Model (create/deleteMany missing).");
    }
    if (typeof Order.create !== "function" || typeof Order.deleteMany !== "function") {
      throw new Error("Order is not a Mongoose Model (create/deleteMany missing).");
    }
  });

  afterAll(async () => {
    const mongooseMod = (await import("mongoose")).default;
    if (mongooseMod.connection.readyState) await mongooseMod.disconnect();
    if (mongod) await mongod.stop();
    jest.restoreAllMocks();
  });

  afterEach(async () => {
    mockBtSale.mockClear();
    await Product.deleteMany({});
    await Order.deleteMany({});
  });

  test("Rejects payment when product IDs or totals do not align (no stock change, no order)", async () => {
    const mongooseMod = (await import("mongoose")).default;
    const { p1, p2 } = await seedProducts(mongooseMod);
    const buyerId = new mongooseMod.Types.ObjectId().toString();
    const token = makeJwt(buyerId);

    const cart = [
      { _id: p1._id.toString(), name: p1.name, price: 1400 }, // wrong price
      { _id: p2._id.toString(), name: p2.name, price: 25 },
    ];

    const res = await request(app)
      .post("/api/v1/product/braintree/payment")
      .set(authHeader(token))
      .send({ nonce: "fake-nonce", cart });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(res.body?.ok).toBe(false);

    const freshP1 = await Product.findById(p1._id);
    const freshP2 = await Product.findById(p2._id);
    expect(freshP1.quantity).toBe(10);
    expect(freshP2.quantity).toBe(7);

    const orders = await Order.find({});
    expect(orders.length).toBe(0);
  });

  test("Succeeds when IDs & totals align; decrements stock and persists order", async () => {
    const mongooseMod = (await import("mongoose")).default;
    const { p1, p2 } = await seedProducts(mongooseMod);
    const buyerId = new mongooseMod.Types.ObjectId().toString();
    const token = makeJwt(buyerId);

    const cart = [
      { _id: p1._id.toString(), name: p1.name, price: p1.price },
      { _id: p2._id.toString(), name: p2.name, price: p2.price },
    ];
    const expectedTotal = p1.price + p2.price;

    const res = await request(app)
      .post("/api/v1/product/braintree/payment")
      .set(authHeader(token))
      .send({ nonce: "fake-nonce", cart });

    expect([200, 201]).toContain(res.status);
    expect(res.body).toEqual(expect.objectContaining({ ok: true }));

    const updatedP1 = await Product.findById(p1._id);
    const updatedP2 = await Product.findById(p2._id);
    expect(updatedP1.quantity).toBe(9);
    expect(updatedP2.quantity).toBe(6);

    const orders = await Order.find({}).lean();
    expect(orders.length).toBe(1);
    const order = orders[0];
    expect(String(order.buyer)).toBe(buyerId);

    const hasP1 = order.products.some(
      (it) =>
        String((it && it._id) || it) === String(p1._id) ||
        (it && it.name === p1.name && it.price === p1.price)
    );
    const hasP2 = order.products.some(
      (it) =>
        String((it && it._id) || it) === String(p2._id) ||
        (it && it.name === p2.name && it.price === p2.price)
    );
    expect(hasP1 && hasP2).toBe(true);

    expect(mockBtSale).toHaveBeenCalledTimes(1);
    const [payloadArg] = mockBtSale.mock.calls[0];
    expect(String(payloadArg.amount)).toBe(String(expectedTotal));
  });

  test("Insufficient stock → rejects and does not create order / change stock", async () => {
    const mongooseMod = (await import("mongoose")).default;
    const { p1 } = await seedProducts(mongooseMod);
    const buyerId = new mongooseMod.Types.ObjectId().toString();
    const token = makeJwt(buyerId);

    const cart = [{ _id: p1._id.toString(), name: p1.name, price: p1.price, qty: 50 }];

    const res = await request(app)
      .post("/api/v1/product/braintree/payment")
      .set(authHeader(token))
      .send({ nonce: "fake-nonce", cart });

    expect([400, 409]).toContain(res.status);
    expect(res.body?.ok).toBe(false);

    const fresh = await Product.findById(p1._id);
    expect(fresh.quantity).toBe(10);

    const orders = await Order.find({});
    expect(orders.length).toBe(0);
  });
});
