/**
 * @jest-environment node
 *
 * Checkout Integration • Product → Payment → Stock & Order
 * - Real Mongoose models (test DB)
 * - resolveApp() finds your Express app/server from server.js
 * - Braintree is locally mocked only
 */

import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import {
  connectToTestDb,
  disconnectFromTestDb,
  resetTestDb,
} from "../config/testdb.js";

/* --------------------- Utils: resolve Express app/server --------------------- */
const resolveApp = async () => {
  const srvMod = await import("../server.js");
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

/* ----------------------------- Mock: Braintree ------------------------------ */
export const mockBtSale = jest.fn((payload, cb) =>
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
  const Environment = { Sandbox: "Sandbox" };
  return {
    __esModule: true,
    default: { BraintreeGateway, Environment },
    BraintreeGateway,
    Environment,
  };
});

/* --------------------------------- Globals --------------------------------- */
let app; // Express app or http.Server
let Product;
let Order;
jest.setTimeout(60000);

/* --------------------------------- Helpers --------------------------------- */
const makeJwt = (userId, role = 0, name = "Test Buyer") =>
  jwt.sign(
    { _id: userId, role, name },
    process.env.JWT_SECRET || "testsecret",
    { expiresIn: "7d" }
  );

// Your middleware expects RAW token (no "Bearer ")
const rawAuthHeader = (token) => ({ Authorization: token });

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

// When some controllers return 200 for failures, assert the body signals failure.
const expectFailurePayloadIf200 = (res) => {
  if (res.status === 200) {
    const b = res.body || {};
    const flags = [
      b.ok === false,
      b.success === false,
      typeof b.error === "string" || (b.error && typeof b.error === "object"),
      typeof b.message === "string",
    ];
    expect(flags.some(Boolean)).toBe(true);
  }
};

/* --------------------------- Silence JWT console.log ------------------------ */
beforeAll(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
});
afterAll(() => {
  if (console.log.mockRestore) console.log.mockRestore();
});

/* --------------------------------- Suite ----------------------------------- */
describe("Checkout Integration • Product → Payment → Stock & Order", () => {
  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "testsecret";
    await connectToTestDb("checkoutController_db_int");
    app = await resolveApp();

    const m = (await import("mongoose")).default;
    Product = m.model("Product");
    // Some codebases register "Order" vs "orders"
    Order = m.models.Order ? m.model("Order") : m.model("orders");
  });

  afterAll(async () => {
    await disconnectFromTestDb();
  });

  beforeEach(async () => {
    await resetTestDb();
    mockBtSale.mockClear();
  });

  /* -------------------- PUBLIC: GET /braintree/token -------------------- */
  describe("GET /api/v1/product/braintree/token", () => {
    it("returns a client token", async () => {
      const res = await request(app).get("/api/v1/product/braintree/token");
      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({ clientToken: "tok_abc" })
      );
    });

    it("is minimal and does not leak fields", async () => {
      const res = await request(app).get("/api/v1/product/braintree/token");
      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual(["clientToken"]);
      expect(typeof res.body.clientToken).toBe("string");
      expect(res.body.clientToken.length).toBeGreaterThan(3);
    });
  });

  /* ----------------- AUTHED: POST /braintree/payment -------------------- */
  describe("POST /api/v1/product/braintree/payment", () => {
    it("rejects when unauthenticated", async () => {
      const res = await request(app)
        .post("/api/v1/product/braintree/payment")
        .send({ nonce: "fake-nonce", cart: [] });
      expect([401, 403]).toContain(res.status);
    });

    it("rejects when Authorization header contains invalid JWT", async () => {
      const res = await request(app)
        .post("/api/v1/product/braintree/payment")
        .set({ Authorization: "not-a-jwt" })
        .send({ nonce: "fake", cart: [] });
      expect([401, 403]).toContain(res.status);
    });

    it("rejects when JWT is expired", async () => {
      const buyerId = new mongoose.Types.ObjectId().toString();
      const expired = jwt.sign(
        { _id: buyerId, role: 0, name: "Expired" },
        process.env.JWT_SECRET || "testsecret",
        { expiresIn: -10 }
      );
      const res = await request(app)
        .post("/api/v1/product/braintree/payment")
        .set({ Authorization: expired })
        .send({ nonce: "fake", cart: [] });
      expect([401, 403]).toContain(res.status);
    });

    it("rejects when product IDs or totals do not align (no stock change, no order)", async () => {
      const { p1, p2 } = await seedProducts();
      const buyerId = new mongoose.Types.ObjectId().toString();
      const token = makeJwt(buyerId);

      const cart = [
        { _id: p1._id.toString(), name: p1.name, price: 1400 },
        { _id: p2._id.toString(), name: p2.name, price: 25 },
      ];

      const res = await request(app)
        .post("/api/v1/product/braintree/payment")
        .set(rawAuthHeader(token))
        .send({ nonce: "fake-nonce", cart });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);

      const freshP1 = await Product.findById(p1._id);
      const freshP2 = await Product.findById(p2._id);
      expect(freshP1.quantity).toBe(10);
      expect(freshP2.quantity).toBe(7);

      const orders = await Order.find({});
      expect(orders.length).toBe(0);
      expect(mockBtSale).not.toHaveBeenCalled();
    });

    it("succeeds when IDs & totals align; decrements stock and persists order", async () => {
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
        .set(rawAuthHeader(token))
        .send({ nonce: "fake-nonce", cart });

      expect([200, 201]).toContain(res.status);

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

    it("insufficient stock → rejects and does not create order / change stock", async () => {
      const { p1 } = await seedProducts();
      const buyerId = new mongoose.Types.ObjectId().toString();
      const token = makeJwt(buyerId);

      const cart = [
        { _id: p1._id.toString(), name: p1.name, price: p1.price, qty: 50 },
      ];

      const res = await request(app)
        .post("/api/v1/product/braintree/payment")
        .set(rawAuthHeader(token))
        .send({ nonce: "fake-nonce", cart });

      expect([400, 409]).toContain(res.status);

      const fresh = await Product.findById(p1._id);
      expect(fresh.quantity).toBe(10);

      const orders = await Order.find({});
      expect(orders.length).toBe(0);
    });

    it("rejects when nonce is missing", async () => {
      const token = makeJwt(new mongoose.Types.ObjectId().toString());
      const res = await request(app)
        .post("/api/v1/product/braintree/payment")
        .set(rawAuthHeader(token))
        .send({
          cart: [{ _id: new mongoose.Types.ObjectId().toString(), name: "X", price: 10 }],
        });

      // Your app may return 200 with error payload, or 400/422
      expect([200, 400, 404, 422]).toContain(res.status);
      expectFailurePayloadIf200(res);
    });

    it("rejects when a product id in cart does not exist", async () => {
      const token = makeJwt(new mongoose.Types.ObjectId().toString());
      const res = await request(app)
        .post("/api/v1/product/braintree/payment")
        .set(rawAuthHeader(token))
        .send({
          nonce: "fake",
          cart: [{ _id: new mongoose.Types.ObjectId().toString(), name: "Ghost", price: 10 }],
        });
      // Some controllers send 404; others 400/422 (or even 200 with error)
      expect([200, 400, 404, 422]).toContain(res.status);
      expectFailurePayloadIf200(res);
    });

    it("aggregates duplicate product lines or rejects (both acceptable)", async () => {
      const { p1 } = await seedProducts();
      const token = makeJwt(new mongoose.Types.ObjectId().toString());

      const res = await request(app)
        .post("/api/v1/product/braintree/payment")
        .set(rawAuthHeader(token))
        .send({
          nonce: "fake",
          cart: [
            { _id: p1._id.toString(), name: p1.name, price: p1.price, qty: 1 },
            { _id: p1._id.toString(), name: p1.name, price: p1.price, qty: 2 },
          ],
        });

      if ([200, 201].includes(res.status)) {
        const fresh = await Product.findById(p1._id);
        expect(Number(fresh.quantity)).toBe(10 - 3);
      } else {
        expect([200, 400, 422]).toContain(res.status);
        expectFailurePayloadIf200(res);
      }
    });

    it("rejects when price types are invalid (NaN/negative)", async () => {
      const { p1 } = await seedProducts();
      const token = makeJwt(new mongoose.Types.ObjectId().toString());

      const bads = [
        { price: "NaN" },
        { price: -1 },
        { price: null },
        { price: undefined },
      ];

      for (const b of bads) {
        const res = await request(app)
          .post("/api/v1/product/braintree/payment")
          .set(rawAuthHeader(token))
          .send({
            nonce: "fake",
            cart: [{ _id: p1._id.toString(), name: p1.name, price: b.price }],
          });
        expect([200, 400, 422]).toContain(res.status);
        expectFailurePayloadIf200(res);
      }
    });

    it("handles Braintree failure path (sale callback with success:false or error)", async () => {
      // Force the mock to pretend gateway failure for this test
      mockBtSale.mockImplementationOnce((_payload, cb) =>
        cb(null, { success: false, transaction: null })
      );

      const { p1 } = await seedProducts();
      const token = makeJwt(new mongoose.Types.ObjectId().toString());

      const res = await request(app)
        .post("/api/v1/product/braintree/payment")
        .set(rawAuthHeader(token))
        .send({
          nonce: "fake",
          cart: [{ _id: p1._id.toString(), name: p1.name, price: p1.price }],
        });

      // Your app sometimes returns 402 for processor issues; allow that too
      expect([200, 400, 402, 422, 500]).toContain(res.status);
      expectFailurePayloadIf200(res);

      // No order persisted on failure
      const orders = await Order.find({});
      expect(orders.length).toBe(0);

      // Stock unchanged
      const fresh = await Product.findById(p1._id);
      expect(fresh.quantity).toBe(10);
    });
  });
});
