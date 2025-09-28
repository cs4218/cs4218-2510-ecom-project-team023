// Tests are written with the help of AI
import {
  updateProfileController,
  getOrdersController,
  getAllOrdersController,
  orderStatusController,
} from "./authController.js";
import userModel from "../models/userModel.js";
import orderModel from "../models/orderModel.js";
import { hashPassword } from "../helpers/authHelper.js";

// Mock the models and helpers
jest.mock("../models/userModel.js");
jest.mock("../models/orderModel.js");
jest.mock("../helpers/authHelper.js");

describe("Auth Controller Unit Tests", () => {
  let req, res;

  // Create mock req and res objects before each test
  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      body: {},
      user: { _id: "userId123" },
      params: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      json: jest.fn(),
    };
  });

  // --- Tests for updateProfileController ---
  describe("updateProfileController", () => {
    // Control-Flow Path 1: Successful update without password change
    it("should update user profile successfully without changing the password", async () => {
      const existingUser = {
        _id: "userId123",
        name: "Old Name",
        password: "oldHashedPassword",
      };
      const updatedUserDetails = { name: "New Name", phone: "1234567890" };
      req.body = updatedUserDetails;

      userModel.findById.mockResolvedValue(existingUser);
      userModel.findByIdAndUpdate.mockResolvedValue({
        ...existingUser,
        ...updatedUserDetails,
      });

      await updateProfileController(req, res);

      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        "userId123",
        {
          name: "New Name",
          phone: "1234567890",
          address: undefined, // Or user.address if it existed
          password: "oldHashedPassword",
        },
        { new: true }
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Profile Updated SUccessfully",
        })
      );
      expect(hashPassword).not.toHaveBeenCalled();
    });

    // Control-Flow Path 2 & BVA: Password update
    describe("Password Update Logic (BVA & EP)", () => {
      // BVA: Invalid Boundary (length 5)
      it("should return an error for passwords less than 6 characters", async () => {
        req.body = { password: "12345" }; // 5 chars
        await updateProfileController(req, res);
        expect(res.json).toHaveBeenCalledWith({
          error: "Passsword is required and 6 character long",
        });
        expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
      });

      // BVA: Valid Boundary (length 6)
      it("should update profile with a new password of exactly 6 characters", async () => {
        req.body = { password: "password" }; // 6 chars
        const user = { _id: "userId123", password: "oldHashedPassword" };
        userModel.findById.mockResolvedValue(user);
        hashPassword.mockResolvedValue("newHashedPassword");
        userModel.findByIdAndUpdate.mockResolvedValue({
          ...user,
          password: "newHashedPassword",
        });

        await updateProfileController(req, res);

        expect(hashPassword).toHaveBeenCalledWith("password");
        expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
          "userId123",
          expect.objectContaining({ password: "newHashedPassword" }),
          { new: true }
        );
        expect(res.status).toHaveBeenCalledWith(200);
      });
    });

    // Control-Flow Path 3: Error handling
    it("should handle errors during profile update and return a 400 status", async () => {
      const error = new Error("Database error");
      userModel.findById.mockRejectedValue(error);
      req.body = { name: "Test" };
      const consoleSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => {});

      await updateProfileController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Error WHile Update profile",
        error,
      });
      expect(consoleSpy).toHaveBeenCalledWith(error);
      consoleSpy.mockRestore();
    });
  });

  // --- Tests for getOrdersController ---
  describe("getOrdersController", () => {
    it("should fetch and return orders for the logged-in user", async () => {
      const mockOrders = [{ _id: "order1" }, { _id: "order2" }];

      // Mock the chain
      const secondPopulateMock = jest.fn().mockResolvedValue(mockOrders);

      const firstPopulateMock = jest.fn().mockReturnValue({
        populate: secondPopulateMock,
      });

      orderModel.find.mockReturnValue({
        populate: firstPopulateMock,
      });

      await getOrdersController(req, res);

      // 4. Assert each step of the chain was called correctly.
      expect(orderModel.find).toHaveBeenCalledWith({ buyer: "userId123" });
      expect(firstPopulateMock).toHaveBeenCalledWith("products", "-photo");
      expect(secondPopulateMock).toHaveBeenCalledWith("buyer", "name");
      expect(res.json).toHaveBeenCalledWith(mockOrders);
    });

    it("should handle errors and return 500 status", async () => {
      const error = new Error("DB lookup failed");
      orderModel.find.mockImplementation(() => ({
        populate: () => ({
          populate: () => Promise.reject(error),
        }),
      }));
      const consoleSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => {});

      await getOrdersController(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Error WHile Geting Orders",
        })
      );
      expect(consoleSpy).toHaveBeenCalledWith(error);
      consoleSpy.mockRestore();
    });
  });

  // --- Tests for getAllOrdersController ---
  describe("getAllOrdersController", () => {
    it("should fetch all orders for an admin", async () => {
      const mockOrders = [{ _id: "order1" }, { _id: "order2" }];
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockOrders),
      };
      orderModel.find.mockReturnValue(mockQuery);
      mockQuery.populate.mockReturnThis();

      await getAllOrdersController(req, res);

      expect(orderModel.find).toHaveBeenCalledWith({});
      expect(mockQuery.populate).toHaveBeenCalledWith("products", "-photo");
      expect(mockQuery.populate).toHaveBeenCalledWith("buyer", "name");
      expect(mockQuery.sort).toHaveBeenCalledWith({ createdAt: "-1" });
      expect(res.json).toHaveBeenCalledWith(mockOrders);
    });
  });

  // --- Tests for orderStatusController ---
  describe("orderStatusController", () => {
    // Equivalence Partitioning: Valid Status
    it("should update an order status with a valid status", async () => {
      req.params = { orderId: "orderId123" };
      req.body = { status: "Shipped" }; // A valid status from the schema enum
      const updatedOrder = { _id: "orderId123", status: "Shipped" };
      orderModel.findByIdAndUpdate.mockResolvedValue(updatedOrder);

      await orderStatusController(req, res);

      expect(orderModel.findByIdAndUpdate).toHaveBeenCalledWith(
        "orderId123",
        { status: "Shipped" },
        { new: true }
      );
      expect(res.json).toHaveBeenCalledWith(updatedOrder);
    });

    // Test for when orderId is invalid or not found
    it("should return null if the orderId is not found", async () => {
      req.params = { orderId: "nonExistentId" };
      req.body = { status: "Shipped" };
      orderModel.findByIdAndUpdate.mockResolvedValue(null); // Simulate not found

      await orderStatusController(req, res);

      expect(orderModel.findByIdAndUpdate).toHaveBeenCalledWith(
        "nonExistentId",
        { status: "Shipped" },
        { new: true }
      );
      expect(res.json).toHaveBeenCalledWith(null);
    });

    // Control-Flow Path: Error handling
    it("should handle database errors and return a 500 status", async () => {
      const error = new Error("Update failed");
      req.params = { orderId: "orderId123" };
      req.body = { status: "Shipped" };
      orderModel.findByIdAndUpdate.mockRejectedValue(error);
      const consoleSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => {});

      await orderStatusController(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Error While Updateing Order",
        })
      );
      expect(consoleSpy).toHaveBeenCalledWith(error);
      consoleSpy.mockRestore();
    });
  });
});
