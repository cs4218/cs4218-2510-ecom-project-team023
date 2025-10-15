// True integration tests for order-related controllers using Supertest
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import supertest from "supertest";
import express from "express";
import User from "../models/userModel.js";
import Order from "../models/orderModel.js";
import Product from "../models/productModel.js";
import Category from "../models/categoryModel.js";
import authRoutes from "../routes/authRoute.js";
import jwt from "jsonwebtoken";

let mongoServer;
let app;
let request;

// Setup Express app for testing
const setupApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/auth", authRoutes);
  return app;
};

// Setup before all tests
beforeAll(async () => {
  // Set JWT_SECRET for testing
  process.env.JWT_SECRET = "testsecretkey";
  
  // Start in-memory MongoDB server
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  
  // Setup Express app and supertest
  app = setupApp();
  request = supertest(app);
});

// Cleanup after all tests
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// Common test setup for all controller tests
let adminUser;
let regularUser;
let secondUser;
let testCategory;
let testProducts;
let testOrders;
let adminToken;
let userToken;

beforeEach(async () => {
  // Create test users
  adminUser = new User({
    name: "Admin User",
    email: "admin@test.com",
    password: "password123",
    phone: "+1234567890",
    address: "123 Admin Street",
    answer: "Admin's security answer",
    role: 1 // Admin role
  });
  await adminUser.save();
  
  regularUser = new User({
    name: "Regular User",
    email: "user@test.com",
    password: "password123",
    phone: "+1987654321",
    address: "456 User Avenue",
    answer: "User's security answer",
    role: 0 // Regular user role
  });
  await regularUser.save();
  
  secondUser = new User({
    name: "Second User",
    email: "second@test.com",
    password: "password123",
    phone: "+1555555555",
    address: "789 Second Road",
    answer: "Second user's security answer",
    role: 0 // Regular user role
  });
  await secondUser.save();
  
  // Create test category
  testCategory = new Category({
    name: "Test Category",
    slug: "test-category"
  });
  await testCategory.save();
  
  // Create test products
  testProducts = [
    new Product({
      name: "Test Product 1",
      slug: "test-product-1",
      description: "Test description 1",
      price: 99.99,
      quantity: 10,
      category: testCategory._id
    }),
    new Product({
      name: "Test Product 2",
      slug: "test-product-2",
      description: "Test description 2",
      price: 49.99,
      quantity: 20,
      category: testCategory._id
    })
  ];
  
  await Product.insertMany(testProducts);
  
  // Create test orders
  testOrders = [
    {
      products: [testProducts[0]._id, testProducts[1]._id],
      payment: { transactionId: "tx123", success: true },
      buyer: regularUser._id,
      status: "Not Process"
    },
    {
      products: [testProducts[0]._id],
      payment: { transactionId: "tx456", success: true },
      buyer: regularUser._id,
      status: "Processing"
    },
    {
      products: [testProducts[1]._id],
      payment: { transactionId: "tx789", success: false },
      buyer: secondUser._id,
      status: "Cancel"
    }
  ];
  
  await Order.insertMany(testOrders);
  
  // Generate JWT tokens for authentication
  adminToken = jwt.sign({ _id: adminUser._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
  userToken = jwt.sign({ _id: regularUser._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
  
  // Do not add Bearer prefix - the middleware expects just the token
});

// Clean up: Clear all data after each test to ensure isolation
afterEach(async () => {
  await User.deleteMany({});
  await Order.deleteMany({});
  await Product.deleteMany({});
  await Category.deleteMany({});
});

// True integration tests for getAllOrdersController
describe("GET /api/v1/auth/all-orders - True Integration Tests", () => {
  it("should return all orders when authenticated as admin", async () => {
    const response = await request
      .get("/api/v1/auth/all-orders")
      .set("Authorization", adminToken);
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("success", true);
    expect(response.body).toHaveProperty("orders");
    expect(Array.isArray(response.body.orders)).toBe(true);
    expect(response.body.orders.length).toBeGreaterThan(0);
    
    // Check that orders are populated with buyer information
    expect(response.body.orders[0]).toHaveProperty("buyer");
    expect(response.body.orders[0].buyer).toHaveProperty("name");
  });
  
  it("should return 401 when not authenticated", async () => {
    const response = await request.get("/api/v1/auth/all-orders");
    
    expect(response.status).toBe(401);
  });
  
  it("should return 401 when authenticated as regular user", async () => {
    const response = await request
      .get("/api/v1/auth/all-orders")
      .set("Authorization", userToken);
    
    expect(response.status).toBe(401);
  });
});

// True integration tests for getOrdersController
describe("GET /api/v1/auth/orders - True Integration Tests", () => {
  it("should return user's orders when authenticated", async () => {
    const response = await request
      .get("/api/v1/auth/orders")
      .set("Authorization", userToken);
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("success", true);
    expect(response.body).toHaveProperty("orders");
    expect(Array.isArray(response.body.orders)).toBe(true);
    
    // Check that orders belong to the authenticated user
    if (response.body.orders.length > 0) {
      expect(response.body.orders[0].buyer._id).toBe(regularUser._id.toString());
    }
  });
  
  it("should return 401 when not authenticated", async () => {
    const response = await request.get("/api/v1/auth/orders");
    
    expect(response.status).toBe(401);
  });
});

// True integration tests for orderStatusController
describe("PUT /api/v1/auth/order-status/:orderId - True Integration Tests", () => {
  it("should update order status when authenticated as admin", async () => {
    // Get the first order ID
    const orders = await Order.find();
    const orderId = orders[0]._id;
    const newStatus = "Shipped";
    
    const response = await request
      .put(`/api/v1/auth/order-status/${orderId}`)
      .set("Authorization", adminToken)
      .send({ status: newStatus });
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("success", true);
    expect(response.body).toHaveProperty("orders");
    expect(response.body.orders).toHaveProperty("status", newStatus);
    
    // Verify the order was updated in the database
    const updatedOrder = await Order.findById(orderId);
    expect(updatedOrder.status).toBe(newStatus);
  });
  
  it("should return 401 when not authenticated", async () => {
    const orders = await Order.find();
    const orderId = orders[0]._id;
    
    const response = await request
      .put(`/api/v1/auth/order-status/${orderId}`)
      .send({ status: "Completed" });
    
    expect(response.status).toBe(401);
  });
  
  it("should return 401 when authenticated as regular user", async () => {
    const orders = await Order.find();
    const orderId = orders[0]._id;
    
    const response = await request
      .put(`/api/v1/auth/order-status/${orderId}`)
      .set("Authorization", userToken)
      .send({ status: "Completed" });
    
    expect(response.status).toBe(401);
  });
  
  it("should return 400 when invalid status is provided", async () => {
    const orders = await Order.find();
    const orderId = orders[0]._id;
    const originalStatus = orders[0].status;
    
    const response = await request
      .put(`/api/v1/auth/order-status/${orderId}`)
      .set("Authorization", adminToken)
      .send({ status: "InvalidStatus" });
    
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("success", false);
    expect(response.body).toHaveProperty("message", "Invalid status value");
    
    // Verify the database was not updated
    const order = await Order.findById(orderId);
    expect(order.status).toBe(originalStatus);
    expect(order.status).not.toBe("InvalidStatus");
  });
  
  it("should return 400 when order does not exist", async () => {
    const nonExistentOrderId = new mongoose.Types.ObjectId();
    
    const response = await request
      .put(`/api/v1/auth/order-status/${nonExistentOrderId}`)
      .set("Authorization", adminToken)
      .send({ status: "Completed" });
    
    expect(response.status).toBe(400);
  });
});