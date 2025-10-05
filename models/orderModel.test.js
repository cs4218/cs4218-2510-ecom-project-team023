// Tests are written with the help of AI
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Order from "./orderModel";

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
  await Order.deleteMany({});
});

describe("Order Model Unit Tests", () => {
  // Test Case: Successful creation with valid data
  it("should create and save an order successfully with all fields", async () => {
    const buyerId = new mongoose.Types.ObjectId();
    const productId = new mongoose.Types.ObjectId();
    const orderData = {
      products: [productId],
      payment: { transactionId: "12345", success: true },
      buyer: buyerId,
      status: "Processing",
    };
    const validOrder = new Order(orderData);

    const savedOrder = await validOrder.save();

    expect(savedOrder._id).toBeDefined();
    expect(savedOrder.products[0]).toEqual(productId);
    expect(savedOrder.payment.success).toBe(true);
    expect(savedOrder.buyer).toEqual(buyerId);
    expect(savedOrder.status).toBe("Processing");
    expect(savedOrder.createdAt).toBeDefined();
    expect(savedOrder.updatedAt).toBeDefined();
  });

  // --- Equivalence Partitioning for 'status' field ---

  // Partition 1: Valid Enum Values
  const validStatuses = [
    "Not Process",
    "Processing",
    "Shipped",
    "Delivered",
    "Cancel",
  ];
  test.each(validStatuses)(
    "should allow saving with a valid status: %s",
    async (status) => {
      const orderData = {
        buyer: new mongoose.Types.ObjectId(),
        status: status,
      };
      const order = new Order(orderData);

      const savedOrder = await order.save();

      expect(savedOrder.status).toBe(status);
    }
  );

  // Partition 2: Default Value
  it("should default the status to 'Not Process' if not provided", async () => {
    const orderData = {
      buyer: new mongoose.Types.ObjectId(),
      // status is omitted
    };
    const order = new Order(orderData);

    const savedOrder = await order.save();

    expect(savedOrder.status).toBe("Not Process");
  });

  // Partition 3: Invalid Enum Value
  it("should fail validation if status is not in the enum list", async () => {
    const orderData = {
      buyer: new mongoose.Types.ObjectId(),
      status: "Pending", // Invalid status
    };
    const order = new Order(orderData);

    let err;
    try {
      await order.save();
    } catch (error) {
      err = error;
    }

    expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
    expect(err.errors.status).toBeDefined();
  });

  // Timestamps
  it("should set createdAt and updatedAt timestamps on document creation", async () => {
    const order = new Order({ buyer: new mongoose.Types.ObjectId() });

    const savedOrder = await order.save();

    expect(savedOrder.createdAt).toBeInstanceOf(Date);
    expect(savedOrder.updatedAt).toBeInstanceOf(Date);
    expect(savedOrder.updatedAt.getTime()).toBe(savedOrder.createdAt.getTime());
  });

  it("should update only the updatedAt timestamp on modification", async () => {
    const order = new Order({ buyer: new mongoose.Types.ObjectId() });
    const savedOrder = await order.save();
    const originalCreatedAt = savedOrder.createdAt;
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Main act: Modify and update the document
    savedOrder.status = "Processing";
    const updatedOrder = await savedOrder.save();

    expect(updatedOrder.createdAt).toEqual(originalCreatedAt);
    expect(updatedOrder.updatedAt.getTime()).toBeGreaterThan(
      updatedOrder.createdAt.getTime()
    );
  });
});
