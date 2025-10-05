// Tests are written with the help of AI
import {
  registerController,
  loginController,
  forgotPasswordController,
  testController,
  updateProfileController,
  getOrdersController,
  getAllOrdersController,
  orderStatusController,
} from "./authController.js";
import userModel from "../models/userModel.js";
import orderModel from "../models/orderModel.js";
import { comparePassword, hashPassword } from "../helpers/authHelper.js";
import JWT from "jsonwebtoken";

// Mock dependencies
jest.mock("../models/userModel.js");
jest.mock("../models/orderModel.js");
jest.mock("../helpers/authHelper.js");
jest.mock("../helpers/authHelper.js");
jest.mock("jsonwebtoken");

// Mock data
const MOCK_REGISTER_REQUEST_BODY = {
  DOB: "1990-01-01",
  name: "Alice",
  email: "alice.tan@example.com",
  password: "password",
  phone: "+65 9123 4567",
  address: "alice's address",
  answer: "My first pet's name",
};

const MOCK_REGISTER_USER_DATA = {
  _id: "64f6c8f4b4dcbf001c8e4a2b",
  name: "Alice",
  email: "alice.tan@example.com",
  password: "$2b$10$N9qo8uLOickgx2ZMRZo4i.ej8fZt5sh9F0D3lJH7Yi9Pa1e7t2Q.e", // bcrypt hash
  phone: "+65 9123 4567",
  address: "alice's address",
  answer: "My first pet's name",
  role: 0, // normal user
  createdAt: "2025-09-27T08:15:30.000Z",
  updatedAt: "2025-09-27T08:15:30.000Z",
  __v: 0,
};

describe("Auth Controller Unit Tests", () => {
  let mockReq, mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      body: {},
      user: { _id: "userId123" },
      params: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      json: jest.fn(),
    };
  });

  describe("registerController Unit Tests", () => {
    test("should return error if any required fields is/are missing", async () => {
      mockReq.body = {};

      await registerController(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: false,
        message:
          "Missing required fields: Name, Email, Password, Phone, Address, Answer",
      });
    });

    test("should reject password shorter than 6 characters", async () => {
      mockReq.body = { ...MOCK_REGISTER_REQUEST_BODY, password: "12345" }; // 5 chars

      await registerController(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: false,
        message: "Password must be at least 6 characters long",
      });
      expect(userModel.findOne).not.toHaveBeenCalled();
    });

    test("should accept password exactly 6 characters", async () => {
      mockReq.body = { ...MOCK_REGISTER_REQUEST_BODY, password: "123456" };
      userModel.findOne.mockResolvedValue(null);
      hashPassword.mockResolvedValue("hashedpassword");
      userModel.mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(MOCK_REGISTER_USER_DATA),
      }));

      await registerController(mockReq, mockRes);

      expect(hashPassword).toHaveBeenCalledWith("123456");
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "User registered successfully",
          user: MOCK_REGISTER_USER_DATA,
        })
      );
    });

    test("should accept password longer than 6 characters", async () => {
      mockReq.body = { ...MOCK_REGISTER_REQUEST_BODY, password: "1234567" };
      userModel.findOne.mockResolvedValue(null);
      hashPassword.mockResolvedValue("hashedpassword");
      userModel.mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(MOCK_REGISTER_USER_DATA),
      }));

      await registerController(mockReq, mockRes);

      expect(hashPassword).toHaveBeenCalledWith("1234567");
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "User registered successfully",
          user: MOCK_REGISTER_USER_DATA,
        })
      );
    });

    test("should return error if user already exists", async () => {
      userModel.findOne.mockResolvedValue(MOCK_REGISTER_USER_DATA);
      mockReq.body = MOCK_REGISTER_REQUEST_BODY;

      await registerController(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "User already registered, please login",
        })
      );
    });

    test("should register new user successfully", async () => {
      userModel.findOne.mockResolvedValue(null);
      hashPassword.mockResolvedValue("hashedpassword");
      userModel.mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(MOCK_REGISTER_USER_DATA),
      }));
      mockReq.body = MOCK_REGISTER_REQUEST_BODY;

      await registerController(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "User registered successfully",
          user: MOCK_REGISTER_USER_DATA,
        })
      );
    });

    test("should handle errors gracefully", async () => {
      const error = new Error("Test error");
      userModel.findOne.mockRejectedValue(error);
      mockReq.body = MOCK_REGISTER_REQUEST_BODY;

      await registerController(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Error while registering user",
          error,
        })
      );
    });
  });

  describe("loginController Unit Tests", () => {
    test("should fail if email missing", async () => {
      mockReq.body = { email: "", password: "123" };

      await loginController(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: false,
        message: "No email or password provided",
      });
    });

    test("should fail if password missing", async () => {
      mockReq.body = { email: "a@test.com", password: "" };

      await loginController(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: false,
        message: "No email or password provided",
      });
    });

    test("should fail if user not found", async () => {
      userModel.findOne.mockResolvedValue(null);
      mockReq.body = { email: "a@test.com", password: "123" };

      await loginController(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Email is not registered",
        })
      );
    });

    test("should fail if password mismatch", async () => {
      userModel.findOne.mockResolvedValue({
        _id: "u1",
        email: "a@test.com",
        password: "hashed123",
        name: "John",
        phone: "999",
        address: "Street",
        role: 0,
      });
      comparePassword.mockResolvedValue(false);
      mockReq.body = { email: "a@test.com", password: "123" };

      await loginController(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Invalid Password",
        })
      );
    });

    test("should login successfully", async () => {
      userModel.findOne.mockResolvedValue({
        _id: "u1",
        email: "a@test.com",
        password: "hashed123",
        name: "John",
        phone: "999",
        address: "Street",
        role: 0,
      });
      comparePassword.mockResolvedValue(true);
      JWT.sign.mockReturnValue("tok123");
      mockReq.body = { email: "a@test.com", password: "123" };

      await loginController(mockReq, mockRes);

      let mockUser = {
        _id: "u1",
        name: "John",
        email: "a@test.com",
        phone: "999",
        address: "Street",
        role: 0,
      };

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "login successfully",
          user: mockUser,
          token: "tok123",
        })
      );
    });

    test("should handle errors", async () => {
      const error = new Error("Test error");
      userModel.findOne.mockRejectedValue(error);
      mockReq.body = { email: "a@test.com", password: "123" };

      await loginController(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Error in login",
          error,
        })
      );
    });
  });

  describe("forgotPasswordController Unit Tests", () => {
    test("should fail if any field is missing", async () => {
      mockReq.body = {};

      await forgotPasswordController(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: false,
        message: "Missing required fields: Email, Answer, New Password",
      });
    });

    test("should fail if user not found", async () => {
      userModel.findOne.mockResolvedValue(null);
      mockReq.body = {
        email: "a@test.com",
        answer: "ans",
        newPassword: "new123",
      };

      await forgotPasswordController(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Wrong Email Or Answer",
        })
      );
    });

    test("should reset password successfully", async () => {
      userModel.findOne.mockResolvedValue({ _id: "u1" });
      hashPassword.mockResolvedValue("hashednew123");
      userModel.findByIdAndUpdate.mockResolvedValue(true);

      mockReq.body = {
        email: "a@test.com",
        answer: "ans",
        newPassword: "new123",
      };

      await forgotPasswordController(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Password Reset Successfully",
        })
      );
    });

    test("should reject newPassword shorter than 6 characters (5 chars)", async () => {
      userModel.findOne.mockResolvedValue({ _id: "u1" });
      mockReq.body = {
        email: "example@email.com",
        answer: "ans",
        newPassword: "12345", // 5 chars
      };

      await forgotPasswordController(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    });

    test("should accept newPassword exactly 6 characters", async () => {
      userModel.findOne.mockResolvedValue({ _id: "u1" });
      hashPassword.mockResolvedValue("hashednew123");
      userModel.findByIdAndUpdate.mockResolvedValue(true);
      mockReq.body = {
        email: "example@email.com",
        answer: "ans",
        newPassword: "123456", // 6 chars
      };

      await forgotPasswordController(mockReq, mockRes);

      expect(hashPassword).toHaveBeenCalledWith("123456");
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Password Reset Successfully",
        })
      );
    });

    test("should accept newPassword longer than 6 characters (7 chars)", async () => {
      userModel.findOne.mockResolvedValue({ _id: "u1" });
      hashPassword.mockResolvedValue("hashednew123");
      userModel.findByIdAndUpdate.mockResolvedValue(true);
      mockReq.body = {
        email: "example@example.com",
        answer: "ans",
        newPassword: "1234567", // 7 chars
      };

      await forgotPasswordController(mockReq, mockRes);

      expect(hashPassword).toHaveBeenCalledWith("1234567");
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Password Reset Successfully",
        })
      );
    });

    test("should handle errors gracefully", async () => {
      const error = new Error("Test error");
      userModel.findOne.mockRejectedValue(error);
      mockReq.body = {
        email: "a@test.com",
        answer: "ans",
        newPassword: "new123",
      };

      await forgotPasswordController(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Something went wrong",
          error,
        })
      );
    });
  });

  describe("testController Unit Tests", () => {
    test("should send protected routes message", () => {
      testController(mockReq, mockRes);

      expect(mockRes.send).toHaveBeenCalledWith("Protected Routes");
    });

    test("should handle errors", () => {
      const error = new Error("Test error");
      const badRes = {
        send: () => {
          throw error;
        },
        status: jest.fn().mockReturnThis(),
      };

      expect(() => testController(mockReq, badRes)).toThrow("Test error");
    });
  });

  describe("updateProfileController Unit Tests", () => {
    let mockReq, mockRes;

    beforeEach(() => {
      jest.clearAllMocks();

      mockReq = {
        user: { _id: "userId123" },
        body: {},
      };

      mockRes = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };
    });

    test("should update user profile successfully without changing the password", async () => {
      const existingUser = {
        _id: "userId123",
        name: "Old Name",
        phone: "9999999999",
        address: "Old Address",
        password: "oldHashedPassword",
      };

      const updatedUserDetails = {
        name: "New Name",
        phone: "1234567890",
        address: "New Address",
      };

      mockReq.body = updatedUserDetails;

      userModel.findById.mockResolvedValue(existingUser);
      userModel.findByIdAndUpdate.mockResolvedValue({
        ...existingUser,
        ...updatedUserDetails,
      });

      await updateProfileController(mockReq, mockRes);

      expect(userModel.findById).toHaveBeenCalledWith("userId123");
      expect(hashPassword).not.toHaveBeenCalled();

      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        "userId123",
        {
          name: "New Name",
          password: "oldHashedPassword",
          phone: "1234567890",
          address: "New Address",
        },
        { new: true }
      );

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Profile updated successfully",
        })
      );
    });

    describe("Password Update Logic (BVA & EP)", () => {
      // BVA - Invalid Boundary (length 5)
      test("should return an error for password shorter than 6 characters", async () => {
        mockReq.body = { password: "12345" }; // 5 chars
        const consoleSpy = jest
          .spyOn(console, "log")
          .mockImplementation(() => {});

        await updateProfileController(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.send).toHaveBeenCalledWith({
          success: false,
          message: "Password is required and 6 characters long",
        });
        expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
        expect(hashPassword).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
      });

      // BVA - Valid Boundary (length 6)
      test("should update profile with a new password of exactly 6 characters", async () => {
        const user = { _id: "userId123", password: "oldHashedPassword" };
        mockReq.body = { password: "abcdef" }; // 6 chars

        userModel.findById.mockResolvedValue(user);
        hashPassword.mockResolvedValue("newHashedPassword");
        userModel.findByIdAndUpdate.mockResolvedValue({
          ...user,
          password: "newHashedPassword",
        });

        await updateProfileController(mockReq, mockRes);

        expect(hashPassword).toHaveBeenCalledWith("abcdef");
        expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
          "userId123",
          expect.objectContaining({ password: "newHashedPassword" }),
          { new: true }
        );
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.send).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            message: "Profile updated successfully",
          })
        );
      });

      // BVA - Valid Boundary (length 7)
      test("should update profile with a new password longer than 6 characters", async () => {
        const user = { _id: "userId123", password: "oldHashedPassword" };
        mockReq.body = { password: "abcdef1" }; // 7 chars

        userModel.findById.mockResolvedValue(user);
        hashPassword.mockResolvedValue("newHashedPassword");
        userModel.findByIdAndUpdate.mockResolvedValue({
          ...user,
          password: "newHashedPassword",
        });

        await updateProfileController(mockReq, mockRes);

        expect(hashPassword).toHaveBeenCalledWith("abcdef1");
        expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
          "userId123",
          expect.objectContaining({ password: "newHashedPassword" }),
          { new: true }
        );
        expect(mockRes.status).toHaveBeenCalledWith(200);
      });
    });

    test("should handle errors during profile update and return 400 status", async () => {
      const error = new Error("Database error");
      userModel.findById.mockRejectedValue(error);
      mockReq.body = { name: "Test" };
      const consoleSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => {});

      await updateProfileController(mockReq, mockRes);

      expect(consoleSpy).toHaveBeenCalledWith(error);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: false,
        message: "Error while updating profile",
        error,
      });

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

      await getOrdersController(mockReq, mockRes);

      expect(orderModel.find).toHaveBeenCalledWith({ buyer: "userId123" });
      expect(firstPopulateMock).toHaveBeenCalledWith("products", "-photo");
      expect(secondPopulateMock).toHaveBeenCalledWith("buyer", "name");
      expect(mockRes.json).toHaveBeenCalledWith(mockOrders);
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

      await getOrdersController(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith(
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

      await getAllOrdersController(mockReq, mockRes);

      expect(orderModel.find).toHaveBeenCalledWith({});
      expect(mockQuery.populate).toHaveBeenCalledWith("products", "-photo");
      expect(mockQuery.populate).toHaveBeenCalledWith("buyer", "name");
      expect(mockQuery.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(mockRes.json).toHaveBeenCalledWith(mockOrders);
    });
  });

  // --- Tests for orderStatusController ---
  describe("orderStatusController", () => {
    // Equivalence Partitioning: Valid Status
    it("should update an order status with a valid status", async () => {
      mockReq.params = { orderId: "orderId123" };
      mockReq.body = { status: "Shipped" }; // A valid status from the schema enum
      const updatedOrder = { _id: "orderId123", status: "Shipped" };
      orderModel.findByIdAndUpdate.mockResolvedValue(updatedOrder);

      await orderStatusController(mockReq, mockRes);

      expect(orderModel.findByIdAndUpdate).toHaveBeenCalledWith(
        "orderId123",
        { status: "Shipped" },
        { new: true }
      );
      expect(mockRes.json).toHaveBeenCalledWith(updatedOrder);
    });

    // Test for when orderId is invalid or not found
    it("should return null if the orderId is not found", async () => {
      mockReq.params = { orderId: "nonExistentId" };
      mockReq.body = { status: "Shipped" };
      orderModel.findByIdAndUpdate.mockResolvedValue(null); // Simulate not found

      await orderStatusController(mockReq, mockRes);

      expect(orderModel.findByIdAndUpdate).toHaveBeenCalledWith(
        "nonExistentId",
        { status: "Shipped" },
        { new: true }
      );
      expect(mockRes.json).toHaveBeenCalledWith(null);
    });

    // Control-Flow Path: Error handling
    it("should handle database errors and return a 500 status", async () => {
      const error = new Error("Update failed");
      mockReq.params = { orderId: "orderId123" };
      mockReq.body = { status: "Shipped" };
      orderModel.findByIdAndUpdate.mockRejectedValue(error);
      const consoleSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => {});

      await orderStatusController(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith(
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
