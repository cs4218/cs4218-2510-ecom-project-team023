// Tests are written with the help of AI
// Integration tests for AdminOrders.js Status Update Flow
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import axios from "axios";
import AdminOrders from "./AdminOrders";
import toast from "react-hot-toast";
import { useAuth } from "../../context/auth";

// MOCKS
jest.mock("axios");
jest.mock("../../context/auth");
jest.mock("react-hot-toast", () => ({
  success: jest.fn(),
  error: jest.fn(),
}));

// Mock the antd Select component to be a simple HTML select; 
jest.mock("antd", () => {
  const antd = jest.requireActual("antd");

  const MockSelect = ({
    children,
    onChange,
    "data-testid": dataTestId,
    defaultValue,
  }) => {
    // When fireEvent.change is called, it triggers this simple handler
    // which in turn calls the component's onChange prop
    const handleChange = (e) => {
      onChange(e.target.value);
    };
    return (
      <select
        data-testid={dataTestId}
        defaultValue={defaultValue}
        onChange={handleChange}
      >
        {children}
      </select>
    );
  };

  // Mock Option
  MockSelect.Option = ({ children, value }) => {
    return <option value={value}>{children}</option>;
  };

  return {
    ...antd,
    Select: MockSelect, // Override Select
  };
});

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

describe("AdminOrders.js Status Update Flow Integration Tests", () => {
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
      ],
      updatedAt: "2023-01-01T00:00:00.000Z",
    },
    {
      _id: "order2",
      status: "Not Process",
      buyer: { name: "Test User 2", _id: "user2" },
      payment: { success: true },
      products: [
        {
          _id: "prod2",
          name: "Test Product 2",
          description: "This is test product 2",
          price: 49.99,
        },
      ],
      updatedAt: "2023-01-02T00:00:00.000Z",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    // Setup auth mock
    useAuth.mockReturnValue([{ token: "test-token" }, jest.fn()]);
  });

  describe("Status Update Flow Tests", () => {
    it("should trigger PUT request to correct endpoint when status is changed", async () => {
      // Setup API response mock
      axios.get.mockResolvedValueOnce({ data: { orders: mockOrders } });
      axios.put.mockResolvedValueOnce({ data: { success: true } });

      render(<AdminOrders />);

      // Wait for orders to be displayed
      await waitFor(() => {
        expect(screen.getAllByTestId(/status-select-\d+/).length).toBe(
          mockOrders.length
        );
      });

      const statusDropdown = screen.getByTestId("status-select-0");
      fireEvent.change(statusDropdown, { target: { value: "Shipped" } });

      // Verify PUT request was made to the correct endpoint with correct data
      await waitFor(() => {
        expect(axios.put).toHaveBeenCalledWith(
          `/api/v1/auth/order-status/${mockOrders[0]._id}`,
          { status: "Shipped" }
        );
      });
    });

    it("should refresh order list after successful status update", async () => {
      // Setup API response mock
      axios.get.mockResolvedValueOnce({ data: { orders: mockOrders } });
      axios.put.mockResolvedValueOnce({ data: { success: true } });

      // Mock GET for refresh (second call), with the updated status
      const updatedOrders = JSON.parse(JSON.stringify(mockOrders));
      updatedOrders[0].status = "Shipped";
      axios.get.mockResolvedValueOnce({ data: { orders: updatedOrders } });
      const toastSuccessSpy = jest.spyOn(toast, "success");

      render(<AdminOrders />);
      // Wait for initial render
      await screen.findByText(mockOrders[0].buyer.name);

      const statusDropdown = screen.getByTestId("status-select-0");
      fireEvent.change(statusDropdown, { target: { value: "Shipped" } });

      // Wait for PUT to be called and toast success to be triggered
      await waitFor(() => {
        expect(axios.put).toHaveBeenCalledWith(
          `/api/v1/auth/order-status/${mockOrders[0]._id}`,
          { status: "Shipped" }
        );
        expect(toastSuccessSpy).toHaveBeenCalledWith(
          "Order status updated successfully"
        );
      });

      // Verify a second GET request was made to refresh the order list
      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(2);
      });

      toastSuccessSpy.mockRestore();
    });

    it("should handle status update error gracefully", async () => {
      // Setup API response mock
      axios.get.mockResolvedValueOnce({ data: { orders: mockOrders } });
      const errorMsg = "Failed to update status";
      // Mock PUT failure
      axios.put.mockRejectedValueOnce(new Error(errorMsg));

      const consoleSpy = jest.spyOn(console, "log").mockImplementation();
      const toastErrorSpy = jest.spyOn(toast, "error");

      render(<AdminOrders />);
      // Wait for initial render
      await screen.findByText(mockOrders[0].buyer.name);

      const statusDropdown = screen.getByTestId("status-select-0");
      fireEvent.change(statusDropdown, { target: { value: "Shipped" } });

      // Wait for PUT to be called
      await waitFor(() => {
        expect(axios.put).toHaveBeenCalledWith(
          `/api/v1/auth/order-status/${mockOrders[0]._id}`,
          { status: "Shipped" }
        );
      });

      // Wait for error handling (console.log and toast.error)
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
        expect(toastErrorSpy).toHaveBeenCalledWith(
          "Something went wrong updating order status"
        );
      });

      consoleSpy.mockRestore();
      toastErrorSpy.mockRestore();
    });

    it("should not attempt to update status when token is missing", async () => {
      // Setup auth mock with no token
      useAuth.mockReturnValue([{}, jest.fn()]);

      // Setup API response mock
      axios.get.mockResolvedValueOnce({ data: { orders: mockOrders } });

      // Render component
      render(<AdminOrders />);

      // Wait for component to render
      await waitFor(() => {});

      // Verify that no API calls were made
      expect(axios.get).not.toHaveBeenCalled();
      expect(axios.put).not.toHaveBeenCalled();
    });

    it("should update multiple orders independently", async () => {
      // Mock GET for initial load
      axios.get.mockResolvedValueOnce({ data: { orders: mockOrders } });

      // Mock PUT success for all subsequent calls
      axios.put.mockResolvedValue({ data: { success: true } });

      render(<AdminOrders />);
      await screen.findByText(mockOrders[0].buyer.name);

      // --- FIRST ORDER UPDATE ---
      const firstDropdown = screen.getByTestId("status-select-0");
      fireEvent.change(firstDropdown, { target: { value: "Shipped" } });

      // Check first PUT call
      await waitFor(() => {
        expect(axios.put).toHaveBeenCalledWith(
          `/api/v1/auth/order-status/${mockOrders[0]._id}`,
          { status: "Shipped" }
        );
      });

      // Check that order list was refreshed (2 total GET calls)
      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(2);
      });

      // --- SECOND ORDER UPDATE ---
      const secondDropdown = screen.getByTestId("status-select-1");
      fireEvent.change(secondDropdown, { target: { value: "Processing" } });

      // Check second PUT call (total 2 PUTs)
      await waitFor(() => {
        expect(axios.put).toHaveBeenCalledTimes(2);
        expect(axios.put).toHaveBeenLastCalledWith(
          `/api/v1/auth/order-status/${mockOrders[1]._id}`,
          { status: "Processing" }
        );
      });

      // Check that order list was refreshed again (3 total GET calls)
      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(3);
      });
    });
  });
});
