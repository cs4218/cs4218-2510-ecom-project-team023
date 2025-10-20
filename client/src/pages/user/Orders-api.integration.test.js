// Tests are written with the help of AI
// Integration tests for Orders.js with API endpoints
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import axios from "axios";
import Orders from "./Orders";
import { useAuth } from "../../context/auth";

// MOCKS
jest.mock("axios");
jest.mock("../../context/auth");

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

describe("Orders.js Integration Tests with API", () => {
  // Sample mock order data
  const mockOrders = [
    {
      _id: "order1",
      status: "Processing",
      buyer: { name: "Test User", _id: "user1" },
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
      buyer: { name: "Test User", _id: "user1" },
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
    it("should fetch orders from the correct API endpoint", async () => {
      // Setup auth mock
      useAuth.mockReturnValue([{ token: "test-token" }, jest.fn()]);

      // Setup API response mock
      axios.get.mockResolvedValueOnce({ data: { orders: mockOrders } });

      // Render component
      render(<Orders />);

      await waitFor(() => {
        // Verify API was called with correct endpoint
      expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/orders");
      });
      
    });

    it("should display the correct number of orders from the API response", async () => {
      // Setup auth mock
      useAuth.mockReturnValue([{ token: "test-token" }, jest.fn()]);

      // Setup API response mock
      axios.get.mockResolvedValueOnce({ data: { orders: mockOrders } });

      // Render component
      render(<Orders />);

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
      render(<Orders />);

      // Wait for orders to be displayed and verify details
      await waitFor(() => {
        // Check status using data-testid
        expect(screen.getByTestId("order-status-0")).toHaveTextContent(
          "Processing"
        );
        expect(screen.getByTestId("order-status-1")).toHaveTextContent(
          "Delivered"
        );

        // Check buyer name
        expect(screen.getAllByText("Test User").length).toBe(2);

        // Check payment status
        expect(screen.getAllByText("Success").length).toBe(2);

        // Check product details
        expect(screen.getByText("Test Product 1")).toBeInTheDocument();
        expect(screen.getByText("Test Product 2")).toBeInTheDocument();
        expect(screen.getByText("Test Product 3")).toBeInTheDocument();

        // Check prices
        expect(screen.getByText("Price : 99.99")).toBeInTheDocument();
        expect(screen.getByText("Price : 49.99")).toBeInTheDocument();
        expect(screen.getByText("Price : 149.99")).toBeInTheDocument();

        // Check product descriptions (truncated to 30 chars)
        expect(screen.getByText("This is test product 1")).toBeInTheDocument();
        expect(screen.getByText("This is test product 2")).toBeInTheDocument();
        expect(screen.getByText("This is test product 3")).toBeInTheDocument();
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
      render(<Orders />);

      // Wait for error handling
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
        expect(
          screen.getByText("You haven't placed any orders yet.")
        ).toBeInTheDocument();
      });

      // Restore console.log
      consoleSpy.mockRestore();
    });

    it("should not make API call when auth token is missing", () => {
      // Setup auth mock with no token
      useAuth.mockReturnValue([{}, jest.fn()]);

      // Render component
      render(<Orders />);

      // Verify API was not called
      expect(axios.get).not.toHaveBeenCalled();
    });
  });
});
