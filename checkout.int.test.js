import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";

jest.mock("./config/db.js", () => ({
  __esModule: true,
  default: async () => {
    const mongooseMod = (await import("mongoose")).default;
    const uri = process.env.MONGO_URL;
    await mongooseMod.connect(uri, { dbName: "ecom_int_test" });
  },
}));

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
      this.clientToken = {
        generate: (_opts, cb) => cb(null, { clientToken: "tok_abc" }),
      };
    }
  }
  return {
    __esModule: true,
    BraintreeGateway,
    Environment: { Sandbox: "Sandbox" },
    default: { BraintreeGateway, Environment: { Sandbox: "Sandbox" } },
  };
});

// ---------- Globals populated in beforeAll ----------
let app;       // Express app (default export from ./server.js)
let mongod;    // MongoMemoryServer
let Product;   // models/productModel.js (default export)
let Order;     // models/orderModel.js (default export)

// ---------- Helpers ----------
const makeJwt = (userId) =>
  jwt.sign({ _id: userId, role: 0, name: "Test Buyer" }, process.env.JWT_SECRET || "testsecret");

// NOTE: your auth middleware likely expects a raw token (no "Bearer " prefix)
const authHeader = (token) => ({ Authorization: token });

// Seed two products with known price & stock
const seedProducts = async () => {
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
    // Spin up in-memory Mongo and prime env BEFORE importing the app
    mongod = await MongoMemoryServer.create();
    process.env.MONGO_URL = mongod.getUri();
    process.env.JWT_SECRET = process.env.JWT_SECRET || "testsecret";

    // Import Express app (default export) — adjust path if server.js isn’t at repo root
    const mod = await import("./server.js");
    app = mod.default;

    // Import models bound to same mongoose instance — adjust paths if needed
    Product = (await import("./models/productModel.js")).default;
    Order   = (await import("./models/orderModel.js")).default;
  });

  afterAll(async () => {
    if (mongoose.connection.readyState) {
      await mongoose.disconnect();
    }
    if (mongod) await mongod.stop();
    jest.restoreAllMocks();
  });

  afterEach(async () => {
    mockBtSale.mockClear();
    await Product.deleteMany({});
    await Order.deleteMany({});
  });

  test("Rejects payment when product IDs or totals do not align (no stock change, no order)", async () => {
    const { p1, p2 } = await seedProducts();
    const buyerId = new mongoose.Types.ObjectId().toString();
    const token = makeJwt(buyerId);

    // Mismatched total: wrong price for p1 (should be 1500, send 1400)
    const cart = [
      { _id: p1._id.toString(), name: p1.name, price: 1400 },
      { _id: p2._id.toString(), name: p2.name, price: 25 },
    ];

    const res = await request(app)
      .post("/api/v1/product/braintree/payment")
      .set(authHeader(token))
      .send({ nonce: "fake-nonce", cart });

    // Expect a 4xx due to server-side validation of totals
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(res.body?.ok).toBe(false);

    // Stock unchanged
    const freshP1 = await Product.findById(p1._id);
    const freshP2 = await Product.findById(p2._id);
    expect(freshP1.quantity).toBe(10);
    expect(freshP2.quantity).toBe(7);

    // No order
    const orders = await Order.find({});
    expect(orders.length).toBe(0);

    // Gateway should not be charged trusted total for mismatched input (optional assert)
  });

  test("Succeeds when IDs & totals align; decrements stock and persists order", async () => {
    const { p1, p2 } = await seedProducts();
    const buyerId = new mongoose.Types.ObjectId().toString();
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

    // Should succeed
    expect([200, 201]).toContain(res.status);
    expect(res.body).toEqual(expect.objectContaining({ ok: true }));

    // Stock decremented
    const updatedP1 = await Product.findById(p1._id);
    const updatedP2 = await Product.findById(p2._id);
    expect(updatedP1.quantity).toBe(9);
    expect(updatedP2.quantity).toBe(6);

    // One order persisted with buyer & items
    const orders = await Order.find({}).lean();
    expect(orders.length).toBe(1);
    const order = orders[0];
    expect(String(order.buyer)).toBe(buyerId);
    expect(order.products).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ _id: p1._id, name: p1.name, price: p1.price }),
        expect.objectContaining({ _id: p2._id, name: p2.name, price: p2.price }),
      ])
    );

    // Gateway received correct total
    expect(mockBtSale).toHaveBeenCalledTimes(1);
    const [payloadArg] = mockBtSale.mock.calls[0];
    expect(String(payloadArg.amount)).toBe(String(expectedTotal));
  });

  test("Insufficient stock → rejects and does not create order / change stock", async () => {
    const { p1 } = await seedProducts();
    const buyerId = new mongoose.Types.ObjectId().toString();
    const token = makeJwt(buyerId);

    // Ask for qty beyond stock (requires your controller to read qty from cart)
    const cart = [{ _id: p1._id.toString(), name: p1.name, price: p1.price, qty: 50 }];

    const res = await request(app)
      .post("/api/v1/product/braintree/payment")
      .set(authHeader(token))
      .send({ nonce: "fake-nonce", cart });

    // Expect rejection (409 Conflict typically)
    expect([400, 409]).toContain(res.status);
    expect(res.body?.ok).toBe(false);

    // Stock unchanged
    const fresh = await Product.findById(p1._id);
    expect(fresh.quantity).toBe(10);

    // No order created
    const orders = await Order.find({});
    expect(orders.length).toBe(0);
  });
});
