// client/src/pages/Products.crud.int.test.js
jest.setTimeout(20000);

import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let app, mongo, Product, Category, User, hashPassword;

// === helpers === written with help from ChatGPT

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
    console.error("LOGIN FAIL", email, res.status, res.body);
  }
  expect(res.status).toBe(200);
  expect(res.body?.success).toBe(true);
  return res.body.token;
}

// seed creds
const adminEmail = "admin@test.local";
const userEmail  = "user@test.local";
const adminPwd   = "Admin#123";
const userPwd    = "User#123";

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

  mongo = await MongoMemoryServer.create();
  process.env.MONGO_URL = mongo.getUri();

  const mod = await import("../../../server.js");
  app = mod.default;

  Product  = (await import("../../../models/productModel.js")).default;
  Category = (await import("../../../models/categoryModel.js")).default;
  User     = (await import("../../../models/userModel.js")).default;

  const helpers = await import("../../../helpers/authHelper.js").catch(() => ({}));
  hashPassword = helpers.hashPassword || (async (x) => x);
});

afterAll(async () => {
  await mongoose.connection?.close();
  await mongo.stop();
});

afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});

describe("Product CRUD API (Supertest)", () => {
  let categoryId;
  let adminToken, userToken;

  beforeEach(async () => {
    const [adminHashed, userHashed] = await Promise.all([
      hashPassword(adminPwd),
      hashPassword(userPwd),
    ]);

    await User.create([
      {
        name: "Admin Tester",
        email: adminEmail,
        password: adminHashed,
        phone: "00000000",
        address: "Nowhere",
        answer: "x",
        role: 1, // admin
      },
      {
        name: "Normal Tester",
        email: userEmail,
        password: userHashed,
        phone: "11111111",
        address: "Somewhere",
        answer: "y",
        role: 0, // non-admin
      },
    ]);

    adminToken = await loginAndGetToken(adminEmail, adminPwd);
    userToken  = await loginAndGetToken(userEmail, userPwd);

    const c = await Category.create({ name: "Electronics", slug: "electronics" });
    categoryId = String(c._id);
  });

  it("admin can create and read a product", async () => {
    const create = await withToken(
      request(app).post("/api/v1/product/create-product"),
      adminToken
    )
      .field("name", "iPhone 15")
      .field("description", "Apple smartphone")
      .field("price", "1399")
      .field("quantity", "10")
      .field("category", categoryId)
      .field("shipping", "1"); 
    if (![200, 201].includes(create.status)) {

      console.error("CREATE FAIL", create.status, create.body);
    }
    expect([200, 201]).toContain(create.status);

 
    let slug = create.body?.slug || create.body?.product?.slug;

    if (!slug) {
      const list = await request(app).get("/api/v1/product/get-product");
      const all = list.body?.products || list.body?.data || list.body || [];
      const found = Array.isArray(all) ? all.find((p) => p?.name === "iPhone 15") : null;
      slug = found?.slug || String(found?._id || "");
    }
    expect(slug).toBeTruthy();

    const get = await request(app).get(`/api/v1/product/get-product/${slug}`);
    expect(get.status).toBe(200);
    const body = get.body.product || get.body;
    expect(body?.name).toBe("iPhone 15");
  });

  //written with help from chatgpt
  it(
    "should allow an admin to update product fields",
    async () => {
      const seed = await Product.create({
        name: "Pixel 8",
        slug: "pixel-8",
        description: "Google phone",
        price: 999,
        category: categoryId,
        quantity: 5,
        shipping: 1,
      });

      let upd = await withToken(
        request(app).put(`/api/v1/product/update-product/${seed._id}`),
        adminToken
      )
        .field("name", "Pixel 8 (Updated)")
        .field("description", "Google phone — updated")
        .field("price", "899")
        .field("quantity", "7")
        .field("category", String(categoryId))
        .field("shipping", "1");

      if (![200, 201].includes(upd.status)) {
        console.error("MULTIPART UPDATE FAIL", upd.status, upd.body);
        upd = await withToken(
          request(app).put(`/api/v1/product/update-product/${seed._id}`),
          adminToken
        )
          .send({
            name: "Pixel 8 (Updated)",
            description: "Google phone — updated",
            price: 899,
            quantity: 7,
            category: String(categoryId),
            shipping: 1,
          })
          .set("Content-Type", "application/json");
      }

      if (![200, 201].includes(upd.status)) {
        console.error("JSON UPDATE FAIL", upd.status, upd.body);
      }
      expect([200, 201]).toContain(upd.status);

      const updated = await Product.findById(seed._id).lean();
      expect(updated).toBeTruthy();
      expect(updated.name).toBe("Pixel 8 (Updated)");
      expect(Number(updated.price)).toBe(899);
      expect(Number(updated.quantity)).toBe(7);
      expect(String(updated.category)).toBe(String(categoryId));
    },
    30000 
  );

  it("should allow an admin to delete a product", async () => {
    const seed = await Product.create({
      name: "Galaxy S23",
      slug: "galaxy-s23",
      description: "Samsung phone",
      price: 1099,
      category: categoryId,
      quantity: 3,
      shipping: 1,
    });

    const del = await withToken(
      request(app).delete(`/api/v1/product/delete-product/${seed._id}`),
      adminToken
    );

    if (![200, 204].includes(del.status)) {
      console.error("DELETE FAIL", del.status, del.body);
    }
    expect([200, 204]).toContain(del.status);

    const after = await request(app).get(`/api/v1/product/get-product/${seed.slug}`);
    const gone =
      [404, 400].includes(after.status) ||
      after.body?.product == null ||
      after.body?.success === false;
    expect(gone).toBe(true);
  });

  it("should fail to create a product with missing fields", async () => {
    const res = await withToken(
      request(app).post("/api/v1/product/create-product"),
      adminToken
    )
      .field("name", "")
      .field("description", "desc")
      .field("price", "100")
      .field("quantity", "1")
      .field("category", categoryId)
      .field("shipping", "1");

    expect([400, 422]).toContain(res.status);
  });

  it("should block non-admin users from creating/updating/deleting", async () => {
    const create = await withToken(
      request(app).post("/api/v1/product/create-product"),
      userToken
    )
      .field("name", "Blocked Product")
      .field("description", "nope")
      .field("price", "999")
      .field("quantity", "1")
      .field("category", categoryId)
      .field("shipping", "1");
    expect([401, 403]).toContain(create.status);

    const seed = await Product.create({
      name: "MacBook",
      slug: "macbook",
      description: "Laptop",
      price: 1999,
      category: categoryId,
      quantity: 5,
      shipping: 1,
    });

    const update = await withToken(
      request(app).put(`/api/v1/product/update-product/${seed._id}`),
      userToken
    )
      .field("name", "Should Not Update")
      .field("description", "nope")
      .field("price", "1")
      .field("quantity", "1")
      .field("category", categoryId)
      .field("shipping", "1");
    expect([401, 403]).toContain(update.status);

    const remove = await withToken(
      request(app).delete(`/api/v1/product/delete-product/${seed._id}`),
      userToken
    );
    expect([401, 403]).toContain(remove.status);
  });
});
