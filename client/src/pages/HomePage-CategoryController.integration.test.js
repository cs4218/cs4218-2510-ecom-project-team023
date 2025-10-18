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

let app, mongod, Category;

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

beforeAll(async () => {
  process.env.NODE_ENV = "test";

  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URL = mongod.getUri();

  // Clear any precompiled models across projects
  if (typeof mongoose.deleteModel === "function") {
    for (const name of ["Category", "Product", "Order", "orders", "User", "users"]) {
      try { mongoose.deleteModel(name); } catch {}
    }
  } else {
    delete mongoose.models.Category;
    delete mongoose.models.Product;
    delete mongoose.models.Order;
    delete mongoose.models.orders;
    delete mongoose.models.User;
    delete mongoose.models.users;
  }

  // Register category schema (the endpoint used by HomePage filters)
  await import("../../../models/categoryModel.js");

  // Resolve the app/server
  app = await resolveApp();

  // Pull compiled model
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

describe("HomePage ↔ CategoryController (public endpoint)", () => {
  it("get-category returns all categories used by HomePage filter list", async () => {
    const cats = await Category.create([
      { name: "Phones", slug: "phones" },
      { name: "Laptops", slug: "laptops" },
      { name: "Accessories", slug: "accessories" },
    ]);

    const res = await request(app).get("/api/v1/category/get-category");
    expect(res.status).toBe(200);

    // Support various controller response shapes
    const list =
      res.body?.category || res.body?.categories || res.body?.data || res.body || [];

    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(3);

    const names = list.map((c) => c.name).sort();
    expect(names).toEqual(["Accessories", "Laptops", "Phones"]);
  });
});
