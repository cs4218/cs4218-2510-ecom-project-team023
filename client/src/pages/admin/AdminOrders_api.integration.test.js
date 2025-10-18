// Tests are written with the help of AI
// Integration tests for AdminOrders.js with API endpoints
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
// Use require for axios to avoid import issues in Jest
const axios = require("axios");
import AdminOrders from "./AdminOrders";
import { useAuth } from "../../context/auth";

// MOCKS
jest.mock("axios");
jest.mock("../../context/auth");

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

describe("AdminOrders.js Integration Tests with API", () => {
  // Sample mock order data
  const mockOrders = [
    {
      _id: "order1",
      status: "Processing",
      buyer: { name: "Test User 1", _id: "user1" },
      payment: { success: true },
      products: [
        {
          _id: "prod1",
          name: "Test Product 1",
          description: "This is test product 1",
          price: 99.99,
        },
        {
          _id: "prod2",
          name: "Test Product 2",
          description: "This is test product 2",
          price: 49.99,
        },
      ],
      updatedAt: "2023-01-01T00:00:00.000Z",
    },
    {
      _id: "order2",
      status: "Delivered",
      buyer: { name: "Test User 2", _id: "user2" },
      payment: { success: true },
      products: [
        {
          _id: "prod3",
          name: "Test Product 3",
          description: "This is test product 3",
          price: 149.99,
        },
      ],
      updatedAt: "2023-01-02T00:00:00.000Z",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("API Integration Tests", () => {
    it("should fetch all orders from the correct API endpoint", async () => {
      // Setup auth mock
      useAuth.mockReturnValue([{ token: "test-token" }, jest.fn()]);

      // Setup API response mock
      axios.get.mockResolvedValueOnce({ data: { orders: mockOrders } });

      // Render component
      render(<AdminOrders />);

      await screen.findByText(mockOrders[0].buyer.name);

      // Verify API was called with correct endpoint
      expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/all-orders");
    });

    it("should display the correct number of orders from the API response", async () => {
      // Setup auth mock
      useAuth.mockReturnValue([{ token: "test-token" }, jest.fn()]);

      // Setup API response mock
      axios.get.mockResolvedValueOnce({ data: { orders: mockOrders } });

      // Render component
      render(<AdminOrders />);

      // Wait for orders to be displayed
      await waitFor(() => {
        // Check that we have the correct number of order rows
        const orderRows = screen.getAllByTestId("order-row");
        expect(orderRows.length).toBe(mockOrders.length);
      });
    });

    it("should display all essential order details from the API response", async () => {
      // Setup auth mock
      useAuth.mockReturnValue([{ token: "test-token" }, jest.fn()]);

      // Setup API response mock
      axios.get.mockResolvedValueOnce({
        data: { success: true, orders: mockOrders },
      });

      // Render component
      render(<AdminOrders />);

      // Wait for orders to be displayed and verify details
      await waitFor(() => {
        // Check status dropdown is visible and initialized with correct values
        const statusSelects = screen.getAllByTestId(/status-select-\d+/);
        expect(statusSelects.length).toBe(mockOrders.length);

        // Check buyer names
        expect(screen.getByText("Test User 1")).toBeInTheDocument();
        expect(screen.getByText("Test User 2")).toBeInTheDocument();

        // Check payment status
        expect(screen.getAllByText("Success").length).toBe(2);

        // Check order numbers - use more specific queries
        const orderRows = screen.getAllByTestId("order-row");
        expect(orderRows[0].querySelector("td").textContent).toBe("1");
        expect(orderRows[1].querySelector("td").textContent).toBe("2");

        // Check product quantities - use more specific approach
        const products = screen.getAllByText(/Product \d+/);
        expect(products.length).toBe(3); // Total 3 products across all orders
      });
    });

    it("should handle API error gracefully", async () => {
      // Setup auth mock
      useAuth.mockReturnValue([{ token: "test-token" }, jest.fn()]);

      // Setup API error mock
      const errorMsg = "Network Error";
      axios.get.mockRejectedValueOnce(new Error(errorMsg));

      // Spy on console.log to verify error handling
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      // Render component
      render(<AdminOrders />);

      // Wait for error handling
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
      });

      // Restore console.log
      consoleSpy.mockRestore();
    });

    it("should not make API call when auth token is missing", () => {
      // Setup auth mock with no token
      useAuth.mockReturnValue([{}, jest.fn()]);

      // Render component
      render(<AdminOrders />);

      // Verify API was not called
      expect(axios.get).not.toHaveBeenCalled();
    });

    it("should display status dropdown for each order with correct initial value", async () => {
      // Setup auth mock
      useAuth.mockReturnValue([{ token: "test-token" }, jest.fn()]);

      // Setup API response mock
      axios.get.mockResolvedValueOnce({
        data: { success: true, orders: mockOrders },
      });

      // Render component
      render(<AdminOrders />);

      // Wait for orders to be displayed
      await waitFor(() => {
        const statusSelects = screen.getAllByTestId(/status-select-\d+/);
        expect(statusSelects.length).toBe(mockOrders.length);

        // Check that the dropdown is rendered with the correct class
        statusSelects.forEach((select) => {
          expect(select).toHaveClass("status-select");
        });

        // Verify the default values match the mock orders by checking the displayed text
        expect(screen.getByText(mockOrders[0].status)).toBeInTheDocument(); // Checks for "Processing"
        expect(screen.getByText(mockOrders[1].status)).toBeInTheDocument(); // Checks for "Delivered"
      });
    });
  });
});
