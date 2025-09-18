/** @jest-environment node */
// list of jest tests written by chatgpt Product schema regressions (tighten constraints)
import {
  jest, describe, test, expect, beforeAll, afterAll, beforeEach,
} from "@jest/globals";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Product from "../models/productModel.js";

jest.setTimeout(60000);

describe("Product schema regressions (tighten constraints)", () => {
  let mongod;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri(), { dbName: "test-db" });

    // Ensure unique indexes (e.g., slug) are created before tests run.
    await Product.syncIndexes();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  // Clear documents but keep indexes intact so unique checks work reliably.
  beforeEach(async () => {
    await Product.deleteMany({});
  });

  test("creates a minimal valid product", async () => {
    const p = await Product.create({
      name: "MacBook Pro",
      slug: "macbook-pro",
      description: "Fast laptop",
      price: 1999,
      category: new mongoose.Types.ObjectId(),
      quantity: 5,
      shipping: true,
    });
    expect(p).toMatchObject({ name: "MacBook Pro", slug: "macbook-pro" });
    expect(p).toHaveProperty("_id");
    expect(p).toHaveProperty("createdAt");
    expect(p).toHaveProperty("updatedAt");
  });

  test("slug must be UNIQUE (duplicate should fail)", async () => {
    await Product.create({
      name: "A",
      slug: "duplicate-slug",
      description: "x",
      price: 1,
      category: new mongoose.Types.ObjectId(),
      quantity: 1,
    });

    await expect(
      Product.create({
        name: "B",
        slug: "duplicate-slug",
        description: "y",
        price: 2,
        category: new mongoose.Types.ObjectId(),
        quantity: 2,
      })
    ).rejects.toMatchObject({ code: 11000 });
  });

  test("slug is lowercased automatically", async () => {
    const saved = await Product.create({
      name: "Cameras",
      slug: "MiXeD-Case",
      description: "x",
      price: 10,
      category: new mongoose.Types.ObjectId(),
      quantity: 1,
    });
    expect(saved.slug).toBe("mixed-case");
  });

  test("name and slug are trimmed", async () => {
    const saved = await Product.create({
      name: "  Nice Chair  ",
      slug: "  nice-chair  ",
      description: "y",
      price: 50,
      category: new mongoose.Types.ObjectId(),
      quantity: 3,
    });
    expect(saved.name).toBe("Nice Chair");
    expect(saved.slug).toBe("nice-chair");
  });

  test("price cannot be negative", async () => {
    await expect(
      Product.create({
        name: "Bad Price",
        slug: "bad-price",
        description: "z",
        price: -1,
        category: new mongoose.Types.ObjectId(),
        quantity: 1,
      })
    ).rejects.toThrow(/price/i);
  });

  test("quantity cannot be negative AND must be an integer", async () => {
    await expect(
      Product.create({
        name: "Neg Qty",
        slug: "neg-qty",
        description: "z",
        price: 1,
        category: new mongoose.Types.ObjectId(),
        quantity: -5,
      })
    ).rejects.toThrow(/quantity/i);

    await expect(
      Product.create({
        name: "Float Qty",
        slug: "float-qty",
        description: "z",
        price: 1,
        category: new mongoose.Types.ObjectId(),
        quantity: 1.5,
      })
    ).rejects.toThrow(/quantity/i);
  });

  test("shipping defaults to false when omitted", async () => {
    const saved = await Product.create({
      name: "Default Shipping",
      slug: "default-shipping",
      description: "x",
      price: 10,
      category: new mongoose.Types.ObjectId(),
      quantity: 1,
    });
    expect(saved.shipping).toBe(false);
  });
});
