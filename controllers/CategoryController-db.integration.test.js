// Some tests written with help of AI
jest.setTimeout(30000);

import request from "supertest";
import mongoose from "mongoose";

// real app + shared in-memory DB helpers 
import {
  connectToTestDb,
  resetTestDb,
  disconnectFromTestDb,
} from "../config/testdb.js";

// models (use real models bound to the active connection)
import User from "../models/userModel.js";
import Category from "../models/categoryModel.js";
import { hashPassword } from "../helpers/authHelper.js";

// --- helpers ---
const adminEmail = "admin@test.local";
const adminPwd   = "Admin#123";

const withToken = (req, token) =>
  req
    .set("Authorization", token)
    .set("authorization", token)
    .set("Cookie", [`token=${token}`]);

const loginAndGetToken = async (app, email, password) => {
  const res = await request(app)
    .post("/api/v1/auth/login")
    .send({ email, password })
    .set("Content-Type", "application/json");
  expect(res.status).toBe(200);
  expect(res.body?.success).toBe(true);
  return res.body.token;
};

// Resolve Express app/http.Server regardless of export shape
const resolveApp = async () => {
  const srvMod = await import("../server.js");
  const cands = [
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
  for (const c of cands) {
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

let app;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

  await connectToTestDb("ecom_category_int");
  app = await resolveApp();
});

afterAll(async () => {
  await disconnectFromTestDb();
});

afterEach(async () => {
  await resetTestDb();
});

describe("Category Routes/Controllers (Integration)", () => {
  let adminToken;

  beforeEach(async () => {
    // seed an admin and login to get JWT (protected routes require it)
    const pwd = await hashPassword(adminPwd);
    await User.create({
      name: "Admin",
      email: adminEmail,
      password: pwd,
      phone: "00000000",
      address: "Nowhere",
      answer: "x",
      role: 1, // admin
    });
    adminToken = await loginAndGetToken(app, adminEmail, adminPwd);
  });

  const listFrom = (body) =>
    body?.category || body?.categories || body?.data || body?.items || body || [];

  it("create-category → lists in get-category, single-category by slug works", async () => {
    // initially empty (public)
    const empty = await request(app).get("/api/v1/category/get-category");
    expect([200, 204]).toContain(empty.status);
    expect(listFrom(empty.body).length).toBe(0);

    // create (protected)
    const c1 = await withToken(
      request(app).post("/api/v1/category/create-category"),
      adminToken
    )
      .send({ name: "Books" })
      .set("Content-Type", "application/json");
    expect([200, 201]).toContain(c1.status);
    expect(c1.body?.success).toBe(true);

    const c2 = await withToken(
      request(app).post("/api/v1/category/create-category"),
      adminToken
    )
      .send({ name: "Electronics" })
      .set("Content-Type", "application/json");
    expect([200, 201]).toContain(c2.status);

    // list (public)
    const list = await request(app).get("/api/v1/category/get-category");
    expect(list.status).toBe(200);
    const names = listFrom(list.body).map((x) => x.name);
    expect(names).toEqual(expect.arrayContaining(["Books", "Electronics"]));

    // single by slug (public)
    const single = await request(app).get("/api/v1/category/single-category/electronics");
    expect([200, 304]).toContain(single.status);
    expect(single.body?.category?.name ?? single.body?.name).toBe("Electronics");
  });

  it("create-category validates name & blocks duplicates (case/trim)", async () => {
    // missing name still needs auth (protected route)
    const miss = await withToken(
      request(app).post("/api/v1/category/create-category"),
      adminToken
    )
      .send({})
      .set("Content-Type", "application/json");
    expect([400, 422]).toContain(miss.status);

    const ok = await withToken(
      request(app).post("/api/v1/category/create-category"),
      adminToken
    )
      .send({ name: "Phones" })
      .set("Content-Type", "application/json");
    expect([200, 201]).toContain(ok.status);

    const dup = await withToken(
      request(app).post("/api/v1/category/create-category"),
      adminToken
    )
      .send({ name: "  phones  " })
      .set("Content-Type", "application/json");
    expect([400, 409]).toContain(dup.status);
  });

  it("update-category updates name+slug; 404 when not found", async () => {
    // seed
    const seed = await withToken(
      request(app).post("/api/v1/category/create-category"),
      adminToken
    )
      .send({ name: "TVs" })
      .set("Content-Type", "application/json");
    const id = seed.body?.category?._id || seed.body?._id;

    // update (protected)
    const upd = await withToken(
      request(app).put(`/api/v1/category/update-category/${id}`),
      adminToken
    )
      .send({ name: "Smart TVs" })
      .set("Content-Type", "application/json");
    expect(upd.status).toBe(200);
    const updatedName = upd.body?.category?.name ?? upd.body?.name;
    const updatedSlug = upd.body?.category?.slug ?? upd.body?.slug;

    // slug is authoritative; name case can vary
    expect(updatedName.toLowerCase()).toBe("smart tvs");
    expect(updatedSlug).toBe("smart-tvs");

    // not found
    const nf = await withToken(
      request(app).put(`/api/v1/category/update-category/66aaaaaaaaaaaaaaa0000000`),
      adminToken
    )
      .send({ name: "X" })
      .set("Content-Type", "application/json");
    expect([404, 400]).toContain(nf.status);
  });

  it("delete-category removes by id; 404 when missing", async () => {
    const a = await withToken(
      request(app).post("/api/v1/category/create-category"),
      adminToken
    )
      .send({ name: "Games" })
      .set("Content-Type", "application/json");
    const b = await withToken(
      request(app).post("/api/v1/category/create-category"),
      adminToken
    )
      .send({ name: "Appliances" })
      .set("Content-Type", "application/json");

    const idA = a.body?.category?._id || a.body?._id;

    const del = await withToken(
      request(app).delete(`/api/v1/category/delete-category/${idA}`),
      adminToken
    );
    expect([200, 204]).toContain(del.status);

    const list = await request(app).get("/api/v1/category/get-category");
    expect(list.status).toBe(200);
    const names = listFrom(list.body).map((x) => x.name);
    expect(names).toEqual(expect.arrayContaining(["Appliances"]));
    expect(names).not.toContain("Games");

    const nf = await withToken(
      request(app).delete(`/api/v1/category/delete-category/66bbbbbbbbbbbbbbb0000000`),
      adminToken
    );
    expect([404, 400]).toContain(nf.status);
  });

  it("single-category returns 404 when slug not found (public)", async () => {
    const res = await request(app).get("/api/v1/category/single-category/missing-slug");
    expect([404, 400]).toContain(res.status);
  });
});
