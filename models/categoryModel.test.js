/** @jest-environment node */
import {
  jest, describe, test, expect, beforeAll, afterAll, beforeEach,
} from "@jest/globals";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Category from "../models/categoryModel.js";

jest.setTimeout(60000);

describe("Category schema regressions (tighten constraints)", () => {
  let mongod;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri(), {
      dbName: "test-db",
      autoIndex: true,     // make sure model indexes can be created
    });

    // Ensure the model's indexes (including the unique one) are built
    await Category.syncIndexes();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  beforeEach(async () => {
    // Keep indexes intact; just clear documents
    await Category.deleteMany({});
  });

  test("requires name", async () => {
    const doc = new Category({ slug: "phones" });
    await expect(doc.validate()).rejects.toThrow(/name/i);
  });

  test("requires slug", async () => {
    const doc = new Category({ name: "Phones" });
    await expect(doc.validate()).rejects.toThrow(/slug/i);
  });

  test("trims name before save", async () => {
    const saved = await Category.create({ name: "  Phones  ", slug: "phones" });
    expect(saved.name).toBe("Phones");
  });

  test("enforces unique name", async () => {
    await Category.create({ name: "Phones", slug: "phones" });
    await expect(
      Category.create({ name: "Phones", slug: "phones-2" })
    ).rejects.toMatchObject({ code: 11000 });
  });

  test("adds timestamps (createdAt/updatedAt)", async () => {
    const saved = await Category.create({ name: "Laptops", slug: "laptops" });
    expect(saved).toHaveProperty("createdAt");
    expect(saved).toHaveProperty("updatedAt");
    expect(saved.createdAt instanceof Date).toBe(true);
  });

  test("lowercases slug", async () => {
    const saved = await Category.create({ name: "Cameras", slug: "MiXeD-Case" });
    expect(saved.slug).toBe("mixed-case");
  });
});
