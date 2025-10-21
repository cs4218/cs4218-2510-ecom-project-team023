// Integration tests for AdminOrders.js with real API endpoints
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
import AdminOrders from "./AdminOrders";
import JWT from "jsonwebtoken";

// MOCKS
// Mock components to isolate AdminOrders component
jest.mock("../../components/AdminMenu", () => {
  return function AdminMenu() {
    return <div data-testid="admin-menu">Mocked Admin Menu</div>;
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

// Mock the antd Select component to be a simple HTML select
jest.mock("antd", () => {
  const antd = jest.requireActual("antd");

  const MockSelect = ({
    children,
    onChange,
    "data-testid": dataTestId,
    defaultValue,
    className,
    value,
  }) => {
    const handleChange = (e) => {
      if (onChange) onChange(e.target.value);
    };
    return (
      <select
        data-testid={dataTestId}
        value={value || defaultValue} // Prefer value if controlled, else defaultValue
        onChange={handleChange}
        className={className || ""}
      >
        {children}
      </select>
    );
  };

  MockSelect.Option = ({ children, value, className }) => {
    return (
      <option value={value} className={className || ""}>
        {children}
      </option>
    );
  };

  return {
    ...antd,
    Select: MockSelect, // Override Select
  };
});

// Setup Test DB
beforeAll(async () => {
  await connectToTestDb("admin-orders-api-int-tests");
});

afterAll(async () => {
  await disconnectFromTestDb();
});

describe("AdminOrders.js Integration Tests with API", () => {
  let server;
  let port;
  let adminUser, user1, prod1, prod2, order1, order2, mockOrders;

  beforeEach(async () => {
    await resetTestDb();
    server = app.listen(7461); // Use a different port
    port = server.address().port;
    axios.defaults.baseURL = `http://localhost:${port}`;

    // 1. Create users (admin and regular)
    const adminHashed = await hashPassword("adminpass");
    adminUser = await userModel.create({
      name: "Admin User",
      email: "admin@example.com",
      password: adminHashed,
      phone: "11111111",
      address: "Admin Street",
      answer: "Test",
      role: 1, // Admin role
    });

    const user1Hashed = await hashPassword("user1pass");
    user1 = await userModel.create({
      name: "Test User 1",
      email: "user1@example.com",
      password: user1Hashed,
      phone: "22222222",
      address: "User1 Street",
      answer: "Test",
      role: 0,
    });

    // 2. Create test products
    prod1 = await productModel.create({
      name: "Test Product 1",
      slug: "test-product-1",
      description: "This is test product 1",
      price: 99.99,
      category: "60f0f0f0f0f0f0f0f0f0f0f0",
      quantity: 10,
    });
    prod2 = await productModel.create({
      name: "Test Product 2",
      slug: "test-product-2",
      description: "This is test product 2",
      price: 49.99,
      category: "60f0f0f0f0f0f0f0f0f0f0f0",
      quantity: 5,
    });

    // 3. Create test orders
    order1 = await orderModel.create({
      products: [prod1._id],
      payment: { success: true },
      buyer: user1._id,
      status: "Processing",
    });
    order2 = await orderModel.create({
      products: [prod2._id],
      payment: { success: true },
      buyer: adminUser._id,
      status: "Delivered",
    });

    // Re-fetch to populate
    mockOrders = await orderModel
      .find({})
      .populate("buyer", "name")
      .populate("products", "-photo")
      .sort({ createdAt: -1 });

    // 4. Set up Auth (log in as ADMIN)
    const token = JWT.sign({ _id: adminUser._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    localStorage.setItem(
      "auth",
      JSON.stringify({
        user: {
          _id: adminUser._id,
          name: adminUser.name,
          email: adminUser.email,
          role: adminUser.role,
        },
        token,
      })
    );

    jest.clearAllMocks();
  });

  afterEach(async () => {
    await new Promise((res) => setTimeout(res, 50));
    await new Promise((resolve) => server.close(resolve));
    localStorage.clear();
  });

  const setup = () =>
    render(
      <AuthProvider>
        <MemoryRouter>
          <AdminOrders />
        </MemoryRouter>
      </AuthProvider>
    );

  describe("API Integration Tests", () => {
    it("should display the correct number of orders from the API response", async () => {
      setup();

      // Wait for orders to be displayed
      await waitFor(() => {
        // Check that we have the correct number of order rows
        const orderRows = screen.getAllByTestId("order-row");
        expect(orderRows.length).toBe(mockOrders.length); // Should be 2
      });
    });

    it("should display buyer names correctly for all orders", async () => {
      // 
      setup();

      await waitFor(() => {
        expect(screen.getByText(adminUser.name)).toBeInTheDocument();
        expect(screen.getByText(user1.name)).toBeInTheDocument();
      });
    });

    it("should display all essential order details from the API response", async () => {
      setup();

      // Wait for orders to be displayed and verify details
      await waitFor(() => {
        // Check buyer names
        expect(screen.getByText(user1.name)).toBeInTheDocument();
        expect(screen.getByText(adminUser.name)).toBeInTheDocument();

        // Check payment status
        expect(screen.getAllByText("Success").length).toBe(2);

        // Check product details
        expect(screen.getByText(prod1.name)).toBeInTheDocument();
        expect(screen.getByText(prod2.name)).toBeInTheDocument();

        // Check quantities
        const quantityCells = screen
          .getAllByTestId("order-row")
          .map((row) => row.cells[5].textContent);
        expect(quantityCells).toContain(String(order1.products.length)); // "1"
        expect(quantityCells).toContain(String(order2.products.length)); // "1"
      });
    });

    it("should display 'No orders yet.' when API returns an empty list", async () => {
      await act(async () => {
        await orderModel.deleteMany({});
      });

      setup();

      await waitFor(() => {
        expect(screen.getByText("No orders yet.")).toBeInTheDocument();
      });
    });

    it("should not make API call when auth token is missing", () => {
      localStorage.clear(); // Ensure no auth token
      setup();

      // Verify "No orders" message is shown
      expect(screen.getByText("No orders yet.")).toBeInTheDocument();
    });

    it("should prevent a non-admin user from fetching all orders", async () => {
      // Log in as a regular user
      const userToken = JWT.sign({ _id: user1._id }, process.env.JWT_SECRET);
      localStorage.setItem(
        "auth",
        JSON.stringify({ user: user1, token: userToken })
      );
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      setup();

      // The middleware should prevent the request, and redirect away; User1's order will not be reflected on screen
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
        expect(screen.queryByText("Test Product 1")).not.toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });

    it("should handle API error gracefully", async () => {
      // Temporarily break the server route
      // Original approach. However, Express routes are registered at app initialization and
      // reassigning app.get doesn't affect already-registered routes.
      // const originalGet = app.get;
      // app.get = jest.fn((path, ...handlers) => {
      //   if (path === "/api/v1/auth/all-orders") {
      //     return (req, res) =>
      //       res.status(500).send({ message: "Server Error" });
      //   }
      //   return originalGet.call(app, path, ...handlers);
      // });

      const axiosGetSpy = jest.spyOn(axios, "get").mockRejectedValueOnce({
        response: {
          status: 500,
          data: { success: false, message: "Server Error" },
        },
      });

      setup();

      await waitFor(() => {
        expect(screen.getByText("No orders yet.")).toBeInTheDocument(); // default fallback
      });

      axiosGetSpy.mockRestore();
      // app.get = originalGet;
    });

    it("should display status dropdown for each order with correct initial value", async () => {
      setup();

      // Wait for orders to be displayed
      await waitFor(() => {
        const statusSelects = screen.getAllByTestId(/status-select-\d+/);
        expect(statusSelects.length).toBe(mockOrders.length);

        // Verify the default values match the mock orders
        // Note: Orders are sorted by date, so order2 (Delivered) is first
        expect(statusSelects[0]).toHaveValue(mockOrders[0].status); // "Delivered"
        expect(statusSelects[1]).toHaveValue(mockOrders[1].status); // "Processing"
      });
    });
  });
});
