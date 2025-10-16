// Tests are written with the help of AI
// Integration tests for order-related controllers with orderModel
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import User from "../models/userModel.js";
import Order from "../models/orderModel.js";
import Product from "../models/productModel.js";
import Category from "../models/categoryModel.js";
import {
  getAllOrdersController,
  getOrdersController,
  orderStatusController,
} from "../controllers/authController.js";

let mongoServer;

// Setup: Connect to in-memory database before all tests
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
  await User.deleteMany({});
  await Order.deleteMany({});
  await Product.deleteMany({});
  await Category.deleteMany({});
});

// Common test setup for all controller tests
let adminUser;
let regularUser;
let secondUser;
let testCategory;
let testProducts;
let testOrders;
let mockReq;
let mockRes;

beforeEach(async () => {
  // Create test users
  adminUser = new User({
    name: "Admin User",
    email: "admin@test.com",
    password: "password123",
    phone: "+1234567890",
    address: "123 Admin Street",
    answer: "Admin's security answer",
    role: 1, // Admin role
  });
  await adminUser.save();

  regularUser = new User({
    name: "Regular User",
    email: "user@test.com",
    password: "password123",
    phone: "+1987654321",
    address: "456 User Avenue",
    answer: "User's security answer",
    role: 0, // Regular user role
  });
  await regularUser.save();

  secondUser = new User({
    name: "Second User",
    email: "second@test.com",
    password: "password123",
    phone: "+1555555555",
    address: "789 Second Road",
    answer: "Second user's security answer",
    role: 0, // Regular user role
  });
  await secondUser.save();

  // Create test category
  testCategory = new Category({
    name: "Test Category",
    slug: "test-category",
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
      category: testCategory._id,
    }),
    new Product({
      name: "Test Product 2",
      slug: "test-product-2",
      description: "Test description 2",
      price: 49.99,
      quantity: 20,
      category: testCategory._id,
    }),
  ];

  await Product.insertMany(testProducts);

  // Create test orders
  const orderData = [
    {
      products: [testProducts[0]._id, testProducts[1]._id],
      payment: { transactionId: "tx123", success: true },
      buyer: regularUser._id,
      status: "Not Process",
    },
    {
      products: [testProducts[0]._id],
      payment: { transactionId: "tx456", success: true },
      buyer: regularUser._id,
      status: "Processing",
    },
    {
      products: [testProducts[1]._id],
      payment: { transactionId: "tx789", success: false },
      buyer: secondUser._id,
      status: "Cancel",
    },
  ];

  // Insert orders and get the saved documents with their IDs
  testOrders = await Order.insertMany(orderData);

  // Mock response object for all tests
  mockRes = {
    json: jest.fn(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
  };
});

describe("getAllOrdersController Integration Tests", () => {
  beforeEach(() => {
    // Mock request object specific to this test suite
    mockReq = {
      user: { _id: adminUser._id },
    };
  });

  it("should retrieve all orders from the database", async () => {
    // Execute the controller
    await getAllOrdersController(mockReq, mockRes);

    // Verify response
    expect(mockRes.json).toHaveBeenCalled();
    const response = mockRes.json.mock.calls[0][0];

    // Verify response structure
    expect(response).toHaveProperty("success", true);
    expect(response).toHaveProperty("orders");
    expect(Array.isArray(response.orders)).toBe(true);

    // Verify that all orders were returned
    expect(response.orders.length).toBe(3);

    // Verify order details
    const statuses = response.orders.map((order) => order.status);
    expect(statuses).toContain("Not Process");
    expect(statuses).toContain("Processing");
    expect(statuses).toContain("Cancel");

    // Verify buyer information is populated
    const buyers = response.orders.map((order) => order.buyer?.name);
    expect(buyers).toContain("Regular User");
    expect(buyers).toContain("Second User");
  });

  it("should handle database query errors with 500 status code", async () => {
    // Mock a database error
    jest.spyOn(Order, "find").mockImplementationOnce(() => {
      throw new Error("Database connection error");
    });

    // Spy on console.log to verify error logging
    const consoleSpy = jest.spyOn(console, "log").mockImplementation();

    // Execute the controller
    await getAllOrdersController(mockReq, mockRes);

    // Verify error handling
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Error While Getting Orders",
      })
    );

    // Verify error was logged
    expect(consoleSpy).toHaveBeenCalled();

    // Restore console.log
    consoleSpy.mockRestore();
  });
});

describe("getOrdersController Integration Tests", () => {
  beforeEach(() => {
    // Mock request object specific to this test suite
    mockReq = {
      user: { _id: regularUser._id },
    };
  });

  it("should retrieve only orders associated with the logged-in user", async () => {
    // Execute the controller
    await getOrdersController(mockReq, mockRes);

    // Verify response
    expect(mockRes.json).toHaveBeenCalled();
    const response = mockRes.json.mock.calls[0][0];

    // Verify response structure
    expect(response).toHaveProperty("success", true);
    expect(response).toHaveProperty("orders");
    expect(Array.isArray(response.orders)).toBe(true);

    // Verify that only the regular user's orders were returned (2 orders)
    expect(response.orders.length).toBe(2);

    // Verify all orders belong to the regular user
    response.orders.forEach((order) => {
      expect(order.buyer._id.toString()).toBe(regularUser._id.toString());
    });

    // Verify order details are correctly populated
    expect(response.orders[0].products).toBeDefined();
    expect(response.orders[0].products.length).toBeGreaterThan(0);
    expect(response.orders[0].status).toBeDefined();
    expect(response.orders[0].payment).toBeDefined();
  });

  it("should handle database query errors with 500 status code", async () => {
    // Mock a database error
    jest.spyOn(Order, "find").mockImplementationOnce(() => {
      throw new Error("Database query failed");
    });

    // Spy on console.log to verify error logging
    const consoleSpy = jest.spyOn(console, "log").mockImplementation();

    // Execute the controller
    await getOrdersController(mockReq, mockRes);

    // Verify error handling
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Error While Getting Orders",
      })
    );

    // Verify error was logged
    expect(consoleSpy).toHaveBeenCalled();

    // Restore console.log
    consoleSpy.mockRestore();
  });
});

describe("orderStatusController Integration Tests", () => {
  let orderId;

  beforeEach(() => {
    // Get the ID of the first order for testing
    orderId = testOrders[0]._id;

    // Mock request object specific to this test suite
    mockReq = {
      user: { _id: adminUser._id },
      params: { orderId: orderId.toString() },
      body: { status: "Shipped" },
    };
  });

  it("should update the status of an existing order", async () => {
    // Set the status to update
    mockReq.body.status = "Delivered";

    // Execute the controller
    await orderStatusController(mockReq, mockRes);

    // Verify response
    expect(mockRes.json).toHaveBeenCalled();
    const response = mockRes.json.mock.calls[0][0];

    // Verify the response format and order status was updated
    expect(response.success).toBe(true);
    expect(response.orders.status).toBe("Delivered");

    // Verify the database was updated
    const dbOrder = await Order.findById(orderId);
    expect(dbOrder.status).toBe("Delivered");
  });

  it("should return null when attempting to update a non-existent order", async () => {
    // Set a non-existent order ID
    mockReq.params.orderId = new mongoose.Types.ObjectId().toString();

    // Execute the controller
    await orderStatusController(mockReq, mockRes);

    // Verify response
    expect(mockRes.json).toHaveBeenCalledWith({
      success: true,
      orders: null,
    });
  });

  it("should handle database errors with 500 status code", async () => {
    // Mock a database error
    jest.spyOn(Order, "findByIdAndUpdate").mockImplementationOnce(() => {
      throw new Error("Database update failed");
    });

    // Spy on console.log to verify error logging
    const consoleSpy = jest.spyOn(console, "log").mockImplementation();

    // Execute the controller
    await orderStatusController(mockReq, mockRes);

    // Verify error handling
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Error While Updating Order",
      })
    );

    // Verify error was logged
    expect(consoleSpy).toHaveBeenCalled();

    // Restore console.log
    consoleSpy.mockRestore();
  });

  it("should validate that only valid status values are accepted", async () => {
    // Try to update with an invalid status
    mockReq.body.status = "InvalidStatus";

    // Execute the controller - this should not throw an error but will be caught in the controller
    await orderStatusController(mockReq, mockRes);

    // Check that the database was not updated with the invalid status
    const dbOrder = await Order.findById(orderId);
    expect(dbOrder.status).not.toBe("InvalidStatus");

    // The controller should have returned an error response
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Invalid status value",
      })
    );
  });
});
