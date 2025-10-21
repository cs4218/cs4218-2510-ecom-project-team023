import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import userModel from "../models/userModel";
import { isAdmin } from "./authMiddleware";

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

// Teardown: Close connection and stop server after all tests
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// Clean up: Clear all data after each test to ensure isolation
afterEach(async () => {
  await userModel.deleteMany({});
});

describe("isAdmin Middleware Integration Tests with DB", () => {
  test("regular user should not be able to access admin routes", async () => {
    const regularUser = new userModel({
      name: "Regular User",
      email: "user@test.com",
      password: "password123",
      phone: "+1987654321",
      address: "456 User Avenue",
      answer: "User's security answer",
      role: 0, // Regular user role
    });
    await regularUser.save();
    const req = { user: { _id: regularUser._id } };
    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
    const next = jest.fn();

    await isAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Unauthorized Access",
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("admin user should be able to access admin routes", async () => {
    const adminUser = new userModel({
      name: "Admin User",
      email: "admin@test.com",
      password: "password123",
      phone: "+1234567890",
      address: "123 Admin Street",
      answer: "Admin's security answer",
      role: 1, // Admin role
    });
    await adminUser.save();
    const req = { user: { _id: adminUser._id } };
    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
    const next = jest.fn();

    await isAdmin(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.send).not.toHaveBeenCalled();
  });
});
