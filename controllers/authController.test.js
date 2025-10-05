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
  getAllUsersController
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

  describe("registerController", () => {
    it("should return error if any required fields is/are missing", async () => {
      mockReq.body = {};
      await registerController(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: false,
        message:
          "Missing required fields: Name, Email, Password, Phone, Address, Answer",
      });
    });

    it("should return error if there is an existing user", async () => {
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

    it("should register new user", async () => {
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

    it("should handle errors", async () => {
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

  describe("loginController", () => {
    it("should fail if email missing", async () => {
      mockReq.body = { email: "", password: "123" };
      await loginController(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: false,
        message: "No email or password provided",
      });
    });

    it("should fail if password missing", async () => {
      mockReq.body = { email: "a@test.com", password: "" };
      await loginController(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: false,
        message: "No email or password provided",
      });
    });

    it("should fail if user not found", async () => {
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

    it("should fail if password mismatch", async () => {
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

    it("should login successfully", async () => {
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

    it("should handle errors", async () => {
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

  describe("forgotPasswordController", () => {
    it("should fail if any field is missing", async () => {
      mockReq.body = {};
      await forgotPasswordController(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
        success: false,
        message: "Missing required fields: Email, Answer, New Password",
      });
    });

    it("should fail if user not found", async () => {
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

    it("should reset password successfully", async () => {
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

    it("should handle errors", async () => {
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

  describe("testController", () => {
    it("should send protected routes message", () => {
      testController(mockReq, mockRes);
      expect(mockRes.send).toHaveBeenCalledWith("Protected Routes");
    });

    it("should handle errors", () => {
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
      mockReq.body = updatedUserDetails;

      userModel.findById.mockResolvedValue(existingUser);
      userModel.findByIdAndUpdate.mockResolvedValue({
        ...existingUser,
        ...updatedUserDetails,
      });

      await updateProfileController(mockReq, mockRes);

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
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(
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
        mockReq.body = { password: "12345" }; // 5 chars
        await updateProfileController(mockReq, mockRes);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: "Passsword is required and 6 character long",
        });
        expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
      });

      // BVA: Valid Boundary (length 6)
      it("should update profile with a new password of exactly 6 characters", async () => {
        mockReq.body = { password: "password" }; // 6 chars
        const user = { _id: "userId123", password: "oldHashedPassword" };
        userModel.findById.mockResolvedValue(user);
        hashPassword.mockResolvedValue("newHashedPassword");
        userModel.findByIdAndUpdate.mockResolvedValue({
          ...user,
          password: "newHashedPassword",
        });

        await updateProfileController(mockReq, mockRes);

        expect(hashPassword).toHaveBeenCalledWith("password");
        expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
          "userId123",
          expect.objectContaining({ password: "newHashedPassword" }),
          { new: true }
        );
        expect(mockRes.status).toHaveBeenCalledWith(200);
      });

      // BVA: Valid Boundary (length 7)
      it("should update profile with a new password of more than 6 characters", async () => {
        mockReq.body = { password: "password1" }; // 6 chars
        const user = { _id: "userId123", password: "oldHashedPassword" };
        userModel.findById.mockResolvedValue(user);
        hashPassword.mockResolvedValue("newHashedPassword");
        userModel.findByIdAndUpdate.mockResolvedValue({
          ...user,
          password: "newHashedPassword",
        });

        await updateProfileController(mockReq, mockRes);

        expect(hashPassword).toHaveBeenCalledWith("password1");
        expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
          "userId123",
          expect.objectContaining({ password: "newHashedPassword" }),
          { new: true }
        );
        expect(mockRes.status).toHaveBeenCalledWith(200);
      });
    });

    // Control-Flow Path 3: Error handling
    it("should handle errors during profile update and return a 400 status", async () => {
      const error = new Error("Database error");
      userModel.findById.mockRejectedValue(error);
      mockReq.body = { name: "Test" };
      const consoleSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => {});

      await updateProfileController(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({
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

describe("getAllUsersController Unit Tests", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      query: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
  });

  // --- EP & BVA: Normal success path ---
  it("should fetch users with default pagination (page=1, limit=10) successfully", async () => {
    const mockUsers = Array.from({ length: 10 }, (_, i) => ({
      _id: `user${i + 1}`,
      name: `User ${i + 1}`,
      email: `user${i + 1}@example.com`,
      createdAt: new Date(),
    }));

    userModel.countDocuments.mockResolvedValue(25);
    userModel.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      skip: jest.fn().mockResolvedValue(mockUsers),
    });

    await getAllUsersController(req, res);

    expect(userModel.countDocuments).toHaveBeenCalledWith({});
    expect(userModel.find).toHaveBeenCalledWith({});
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({
      success: true,
      message: "Paginated users list fetched successfully",
      users: mockUsers,
      currentPage: 1,
      totalPages: 3,
      totalUsers: 25,
      limit: 10,
    });
  });

  // --- BVA: Page 1 boundary ---
  it("should handle first page correctly", async () => {
    req.query.page = "1";
    req.query.limit = "5";

    const mockUsers = Array.from({ length: 5 }, (_, i) => ({ _id: `u${i+1}` }));

    userModel.countDocuments.mockResolvedValue(12);
    userModel.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      skip: jest.fn().mockResolvedValue(mockUsers),
    });

    await getAllUsersController(req, res);

    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ currentPage: 1, totalPages: 3, limit: 5 })
    );
  });

  // --- BVA: Last page boundary ---
  it("should handle last page with remaining users correctly", async () => {
    req.query.page = "3";
    req.query.limit = "5";

    const mockUsers = Array.from({ length: 2 }, (_, i) => ({ _id: `u${i+11}` })); // last 2 users

    userModel.countDocuments.mockResolvedValue(12);
    userModel.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      skip: jest.fn().mockResolvedValue(mockUsers),
    });

    await getAllUsersController(req, res);

    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ currentPage: 3, totalPages: 3, users: mockUsers })
    );
  });

  // --- EP: Arbitrary page and limit ---
  it("should handle arbitrary page and limit correctly", async () => {
    req.query.page = "2";
    req.query.limit = "4";

    const mockUsers = Array.from({ length: 4 }, (_, i) => ({ _id: `u${i+5}` }));

    userModel.countDocuments.mockResolvedValue(10);
    userModel.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      skip: jest.fn().mockResolvedValue(mockUsers),
    });

    await getAllUsersController(req, res);

    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ currentPage: 2, totalPages: 3, users: mockUsers, limit: 4 })
    );
  });

  // --- BVA: page and limit missing or invalid values ---
  it("should default to page=1 and limit=10 if query params are missing or invalid", async () => {
    req.query.page = "invalid";
    req.query.limit = "invalid";

    const mockUsers = Array.from({ length: 10 }, (_, i) => ({ _id: `user${i+1}` }));

    userModel.countDocuments.mockResolvedValue(20);
    userModel.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      skip: jest.fn().mockResolvedValue(mockUsers),
    });

    await getAllUsersController(req, res);

    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ currentPage: 1, limit: 10, totalPages: 2 })
    );
  });

  // --- Error Handling ---
  it("should return 500 and error message if database fails", async () => {
    const error = new Error("DB failure");
    userModel.countDocuments.mockRejectedValue(error);

    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    await getAllUsersController(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Error while getting all users with pagination",
        error: "DB failure",
      })
    );
    expect(consoleSpy).toHaveBeenCalledWith(error);

    consoleSpy.mockRestore();
  });

  // --- EP: Empty result set ---
  it("should return empty users array if no users exist", async () => {
    userModel.countDocuments.mockResolvedValue(0);
    userModel.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      skip: jest.fn().mockResolvedValue([]),
    });

    await getAllUsersController(req, res);

    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ users: [], totalUsers: 0, totalPages: 0 })
    );
  });
});
