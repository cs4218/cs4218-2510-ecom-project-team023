// Integration tests for Orders.js with real API endpoints
import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import axios from "axios";
import { MemoryRouter } from "react-router-dom";
import {
  connectToTestDb,
  disconnectFromTestDb,
  resetTestDb,
} from "../../../../config/testdb.js";
import app from "../../../../server.js";
import userModel from "../../../../models/userModel.js";
import productModel from "../../../../models/productModel.js";
import orderModel from "../../../../models/orderModel.js";
import { hashPassword } from "../../../../helpers/authHelper.js";
import { AuthProvider } from "../../context/auth";
import Orders from "./Orders";
import JWT from "jsonwebtoken";

// MOCKS
// Mock components to isolate Orders component
jest.mock("../../components/UserMenu", () => {
  return function UserMenu() {
    return <div data-testid="user-menu">Mocked User Menu</div>;
  };
});

jest.mock("../../components/Layout", () => {
  return function Layout({ title, children }) {
    return (
      <div data-testid="layout">
        <div data-testid="layout-title">{title}</div>
        <div data-testid="layout-children">{children}</div>
      </div>
    );
  };
});

// Mock moment for consistent date display
jest.mock("moment", () => {
  return jest.fn(() => ({
    fromNow: jest.fn(() => "2 days ago"),
  }));
});

// Setup Test DB
beforeAll(async () => {
  await connectToTestDb("orders-api-int-tests");
});

afterAll(async () => {
  await disconnectFromTestDb();
});

describe("Orders.js Integration Tests with API", () => {
  let server;
  let port;
  let testUserA, testUserB, prod1, prod2, prod3, prod4, mockOrders;

  beforeEach(async () => {
    await resetTestDb();
    server = app.listen(7460); // Use a different port
    port = server.address().port;
    axios.defaults.baseURL = `http://localhost:${port}`;

    // 1. Create a test user
    const hashedA = await hashPassword("strongpass");
    testUserA = await userModel.create({
      name: "Test User",
      email: "test@example.com",
      password: hashedA,
      phone: "91234567",
      address: "123 Street",
      answer: "Football",
    });

    const hashedB = await hashPassword("passB");
    testUserB = await userModel.create({
      name: "User B",
      email: "userB@example.com",
      password: hashedB,
      phone: "22222222",
      address: "2 Street",
      answer: "Soccer",
    });

    // 2. Create test products
    prod1 = await productModel.create({
      name: "Test Product A1",
      slug: "test-product-A1",
      description: "This is test product A1 for testUserA",
      price: 99.99,
      category: "60f0f0f0f0f0f0f0f0f0f0f0", // Mock category ID
      quantity: 10,
    });
    prod2 = await productModel.create({
      name: "Test Product A2",
      slug: "test-product-A2",
      description: "This is test product A2 for testUserA",
      price: 49.99,
      category: "60f0f0f0f0f0f0f0f0f0f0f0",
      quantity: 5,
    });
    prod3 = await productModel.create({
      name: "Test Product A3",
      slug: "test-product-A3",
      description: "This is test product A3 for testUserA",
      price: 149.99,
      category: "60f0f0f0f0f0f0f0f0f0f0f0",
      quantity: 2,
    });
    prod4 = await productModel.create({
      name: "Test Product B1",
      slug: "test-product-B1",
      description: "This is test product B1 for testUserB",
      price: 149.99,
      category: "60f0f0f0f0f0f0f0f0f0f0f0",
      quantity: 2,
    });

    // 3. Create test orders
    const orderA1 = await orderModel.create({
      products: [prod1._id, prod2._id],
      payment: { success: true },
      buyer: testUserA._id,
      status: "Processing",
    });
    const orderA2 = await orderModel.create({
      products: [prod3._id],
      payment: { success: true },
      buyer: testUserA._id,
      status: "Delivered",
    });
    const orderB1 = await orderModel.create({
      products: [prod4._id],
      payment: { success: true },
      buyer: testUserB._id,
      status: "Delivered",
    });

    // Re-fetch to populate buyer
    mockOrders = await orderModel
      .find({ buyer: testUserA._id })
      .populate("buyer", "name")
      .populate("products", "-photo")
      .sort({ createdAt: -1 });

    // 4. Set up Auth; Only testUserA is logged in
    loginUser(testUserA);

    jest.clearAllMocks();
  });

  afterEach(async () => {
    await new Promise((res) => setTimeout(res, 50));
    await new Promise((resolve) => server.close(resolve));
    localStorage.clear();
  });

  const loginUser = (user) => {
    const token = JWT.sign({ _id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    localStorage.setItem(
      "auth",
      JSON.stringify({
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        token,
      })
    );
  };

  const setup = () =>
    render(
      <AuthProvider>
        <MemoryRouter>
          <Orders />
        </MemoryRouter>
      </AuthProvider>
    );

  describe("API Integration Tests", () => {
    it("should fetch and display ONLY the logged-in user's orders", async () => {
      // By default, only testUserA is logged in
      setup();

      // The server controller retrieves the correct orders (testUserA only)
      // The page displays accurate order details
      await waitFor(() => {
        expect(screen.getByText("Test Product A1")).toBeInTheDocument();
      });

      // Verify that testUserB's order is NOT displayed
      expect(screen.queryByText("Test Product B1")).not.toBeInTheDocument();
    });

    it("should display the correct number of orders from the API response", async () => {
      setup();

      // Wait for orders to be displayed
      await waitFor(() => {
        // Check that we have the correct number of order rows
        const orderRows = screen.getAllByTestId("order-row");
        expect(orderRows.length).toBe(mockOrders.length); // Should be 2
      });
    });

    it("should display all essential order details from the API response", async () => {
      setup();

      // Wait for orders to be displayed and verify details
      await waitFor(() => {
        // Check status using data-testid
        expect(screen.getByTestId("order-status-0")).toHaveTextContent(
          mockOrders[1].status // "Processing" (sorted by-default)
        );
        expect(screen.getByTestId("order-status-1")).toHaveTextContent(
          mockOrders[0].status // "Delivered"
        );

        // Check buyer name
        expect(screen.getAllByText(testUserA.name).length).toBe(2);

        // Check payment status
        expect(screen.getAllByText("Success").length).toBe(2);

        // Check product details
        expect(screen.getByText(prod1.name)).toBeInTheDocument();
        expect(screen.getByText(prod2.name)).toBeInTheDocument();
        expect(screen.getByText(prod3.name)).toBeInTheDocument();

        // Check prices
        expect(screen.getByText(`Price : ${prod1.price}`)).toBeInTheDocument();
        expect(screen.getByText(`Price : ${prod2.price}`)).toBeInTheDocument();
        expect(screen.getByText(`Price : ${prod3.price}`)).toBeInTheDocument();
      });
    });

    it("should display 'You haven't placed any orders yet.' when API returns an empty list", async () => {
      // Clear orders for this test
      await act(async () => {
        orderModel.deleteMany({});
      });

      setup();

      // Wait for the "No orders yet." text to appear
      expect(
        await screen.findByText("You haven't placed any orders yet.")
      ).toBeInTheDocument();

      // Ensure no order data is rendered
      expect(screen.queryByText("Status")).not.toBeInTheDocument();
    });

    it("should not make API call and show 'no orders' when auth token is missing", () => {
      localStorage.clear(); // Ensure no auth token
      setup();

      // Verify "No orders" message is shown
      expect(
        screen.getByText("You haven't placed any orders yet.")
      ).toBeInTheDocument();
    });

    it("should handle API error gracefully", async () => {
      // Temporarily break the server route
      const originalGet = app.get;
      app.get = jest.fn((path, ...handlers) => {
        if (path === "/api/v1/auth/orders") {
          return (req, res) =>
            res.status(500).send({ message: "Server Error" });
        }
        return originalGet.call(app, path, ...handlers);
      });

      setup();

      await waitFor(() => {
        expect(
          screen.getByText("You haven't placed any orders yet.") // default fallback
        ).toBeInTheDocument();
      });

      app.get = originalGet; // Restore original route handler
    });
  });
});
