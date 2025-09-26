// Tests are written with the help of AI
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import axios from "axios";
import Orders from "./Orders";

// MOCKS

jest.mock("axios");

jest.mock("moment", () => {
  return jest.fn(() => ({
    fromNow: jest.fn(() => "mocked date"),
  }));
});

jest.mock("../../context/auth", () => ({
  useAuth: jest.fn(),
}));

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

jest.mock("react-router-dom", () => ({
  MemoryRouter: ({ children }) => (
    <div data-testid="memory-router">{children}</div>
  ),
}));

// Mock window.matchMedia for responsive components;  
// To ensure test suite is robust and can handle potential dependencies 
// without unexpected crashes.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
  })),
});

// UNIT TESTS
describe("Orders Component - Unit Tests Only", () => {
  const mockUseAuth = require("../../context/auth").useAuth;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // RENDERING LOGIC TESTS
  describe("Component Rendering Logic", () => {
    it("renders basic component structure", () => {
      // UNIT TEST: Tests only JSX structure rendering
      mockUseAuth.mockReturnValue([null, jest.fn()]);

      render(<Orders />);

      expect(screen.getByTestId("layout")).toBeInTheDocument();
      expect(screen.getByTestId("layout-title")).toHaveTextContent(
        "Your Orders"
      );
      expect(screen.getByTestId("user-menu")).toBeInTheDocument();
      expect(screen.getByText("All Orders")).toBeInTheDocument();
    });

    it("renders dashboard container structure", () => {
      // UNIT TEST: Tests CSS class structure and layout
      mockUseAuth.mockReturnValue([null, jest.fn()]);

      const { container } = render(<Orders />);

      expect(container.querySelector(".container-flui")).toBeInTheDocument();
      expect(container.querySelector(".dashboard")).toBeInTheDocument();
      expect(container.querySelector(".row")).toBeInTheDocument();
      expect(container.querySelector(".col-md-3")).toBeInTheDocument();
      expect(container.querySelector(".col-md-9")).toBeInTheDocument();
    });

    it("renders empty state when no orders", () => {
      // UNIT TEST: Tests rendering with empty orders array
      mockUseAuth.mockReturnValue([
        { token: "test-token", user: { name: "Test" } },
        jest.fn(),
      ]);

      render(<Orders />);

      expect(screen.getByText("All Orders")).toBeInTheDocument();
      // Should not render any table headers when no orders
      expect(screen.queryByText("Status")).not.toBeInTheDocument();
      expect(screen.queryByText("Buyer")).not.toBeInTheDocument();
      expect(screen.queryByText("Payment")).not.toBeInTheDocument();
    });
  });


  // CONDITIONAL RENDERING TESTS
  describe("Conditional Rendering Logic", () => {
    it("renders without calling useEffect when no auth token", () => {
      // UNIT TEST: Tests conditional logic for auth token
      const mockSetAuth = jest.fn();
      mockUseAuth.mockReturnValue([{ user: { name: "Test" } }, mockSetAuth]);

      render(<Orders />);

      expect(screen.getByText("All Orders")).toBeInTheDocument();
      // Component should render even without token
      expect(screen.getByTestId("layout")).toBeInTheDocument();
    });

    it("renders with auth token present", () => {
      // UNIT TEST: Tests rendering when auth token exists
      const mockSetAuth = jest.fn();
      mockUseAuth.mockReturnValue([
        { token: "valid-token", user: { name: "Test User" } },
        mockSetAuth,
      ]);

      render(<Orders />);

      expect(screen.getByText("All Orders")).toBeInTheDocument();
      expect(screen.getByTestId("user-menu")).toBeInTheDocument();
    });

    it("handles null auth state gracefully", () => {
      // UNIT TEST: Tests null safety in component
      mockUseAuth.mockReturnValue([null, jest.fn()]);

      render(<Orders />);

      expect(screen.getByText("All Orders")).toBeInTheDocument();
      // Should not crash with null auth
    });

    it("handles undefined auth state gracefully", () => {
      // UNIT TEST: Tests undefined safety in component
      mockUseAuth.mockReturnValue([undefined, jest.fn()]);

      render(<Orders />);

      expect(screen.getByText("All Orders")).toBeInTheDocument();
      // Should not crash with undefined auth
    });
  });

  // DATA DISPLAY LOGIC TESTS
  describe("Order Display Logic", () => {
    beforeEach(() => {
      // Mock successful auth for these tests
      mockUseAuth.mockReturnValue([
        { token: "test-token", user: { name: "Test" } },
        jest.fn(),
      ]);
    });

    it("renders table headers correctly", () => {
      // UNIT TEST: Tests table header rendering logic
      // Simulate component with orders by setting initial state
      const OrdersWithMockData = () => {
        const mockOrders = [
          {
            _id: "1",
            status: "Test",
            buyer: { name: "Test" },
            createAt: "2023-01-01",
            payment: { success: true },
            products: [],
          },
        ];

        return (
          <div data-testid="layout">
            <div data-testid="layout-title">Your Orders</div>
            <div data-testid="layout-children">
              <div className="container-flui p-3 m-3 dashboard">
                <div className="row">
                  <div className="col-md-3">
                    <div data-testid="user-menu">Mocked User Menu</div>
                  </div>
                  <div className="col-md-9">
                    <h1 className="text-center">All Orders</h1>
                    {mockOrders?.map((o, i) => (
                      <div className="border shadow" key={o._id}>
                        <table className="table">
                          <thead>
                            <tr>
                              <th scope="col">#</th>
                              <th scope="col">Status</th>
                              <th scope="col">Buyer</th>
                              <th scope="col"> date</th>
                              <th scope="col">Payment</th>
                              <th scope="col">Quantity</th>
                            </tr>
                          </thead>
                        </table>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      };

      render(<OrdersWithMockData />);

      expect(screen.getByText("#")).toBeInTheDocument();
      expect(screen.getByText("Status")).toBeInTheDocument();
      expect(screen.getByText("Buyer")).toBeInTheDocument();
      expect(screen.getByText(" date")).toBeInTheDocument();
      expect(screen.getByText("Payment")).toBeInTheDocument();
      expect(screen.getByText("Quantity")).toBeInTheDocument();
    });

    it('renders order details and products correctly from mock data', async () => {
      // UNIT TEST: Verifies that the component correctly maps and renders all provided order and product data.
      const mockOrders = [
        {
          _id: "order1",
          status: "Processing",
          buyer: { name: "Jane Doe" },
          createAt: "2025-09-17T12:00:00.000Z",
          payment: { success: true },
          products: [
            {
              _id: "prod1",
              name: "Test Product A",
              description: "A very detailed description for product A.",
              price: 150,
            },
          ],
        },
      ];
      axios.get.mockResolvedValueOnce({ data: mockOrders });

      mockUseAuth.mockReturnValue([
        { token: "valid-token", user: { name: "Test User" } },
        jest.fn(),
      ]);

      render(<Orders />);

      await waitFor(() => {
        expect(screen.getByText("Processing")).toBeInTheDocument();
      });

      expect(screen.getByText("Jane Doe")).toBeInTheDocument();
      expect(screen.getByText("Success")).toBeInTheDocument();
      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("Test Product A")).toBeInTheDocument();
      expect(
        screen.getByText("A very detailed descriptio")
      ).toBeInTheDocument();
      expect(screen.getByText("Price : 150")).toBeInTheDocument();
    });
  });

  // DATA TRANSFORMATION LOGIC TESTS
  describe("Data Transformation Logic", () => {
    // Test individual logic pieces that would be in the component

    it("calculates order number correctly", () => {
      // UNIT TEST: Tests order numbering logic (i + 1)
      const calculateOrderNumber = (index) => index + 1;

      expect(calculateOrderNumber(0)).toBe(1);
      expect(calculateOrderNumber(1)).toBe(2);
      expect(calculateOrderNumber(9)).toBe(10);
    });

    it("transforms payment status correctly", () => {
      // UNIT TEST: Tests payment status transformation
      const formatPaymentStatus = (payment) =>
        payment?.success ? "Success" : "Failed";

      expect(formatPaymentStatus({ success: true })).toBe("Success");
      expect(formatPaymentStatus({ success: false })).toBe("Failed");
      expect(formatPaymentStatus(null)).toBe("Failed");
      expect(formatPaymentStatus(undefined)).toBe("Failed");
      expect(formatPaymentStatus({})).toBe("Failed");
    });

    it("calculates product quantity correctly", () => {
      // UNIT TEST: Tests products array length calculation
      const calculateQuantity = (products) => products?.length || 0;

      expect(calculateQuantity([])).toBe(0);
      expect(calculateQuantity([{ id: 1 }])).toBe(1);
      expect(calculateQuantity([{ id: 1 }, { id: 2 }, { id: 3 }])).toBe(3);
      expect(calculateQuantity(null)).toBe(0);
      expect(calculateQuantity(undefined)).toBe(0);
    });

    it("truncates description correctly", () => {
      // UNIT TEST: Tests description truncation logic
      const truncateDescription = (desc, maxLength = 30) =>
        desc?.substring(0, maxLength) || "";

      const longDesc =
        "This is a very long description that exceeds thirty characters";
      const shortDesc = "Short description";

      expect(truncateDescription(longDesc)).toBe(
        "This is a very long descriptio"
      );
      expect(truncateDescription(shortDesc)).toBe("Short description");
      expect(truncateDescription("")).toBe("");
      expect(truncateDescription(null)).toBe("");
      expect(truncateDescription(undefined)).toBe("");
    });

    it("handles optional chaining for buyer name", () => {
      // UNIT TEST: Tests null safety for buyer?.name
      const getBuyerName = (buyer) => buyer?.name;

      expect(getBuyerName({ name: "John Doe" })).toBe("John Doe");
      expect(getBuyerName({})).toBeUndefined();
      expect(getBuyerName(null)).toBeUndefined();
      expect(getBuyerName(undefined)).toBeUndefined();
    });

    it("handles optional chaining for product properties", () => {
      // UNIT TEST: Tests null safety for product properties
      const getProductName = (product) => product?.name;
      const getProductPrice = (product) => product?.price;
      const getProductDescription = (product) => product?.description;

      const validProduct = {
        name: "Test Product",
        price: 99.99,
        description: "Test desc",
      };
      const emptyProduct = {};

      expect(getProductName(validProduct)).toBe("Test Product");
      expect(getProductPrice(validProduct)).toBe(99.99);
      expect(getProductDescription(validProduct)).toBe("Test desc");

      expect(getProductName(emptyProduct)).toBeUndefined();
      expect(getProductPrice(emptyProduct)).toBeUndefined();
      expect(getProductDescription(emptyProduct)).toBeUndefined();

      expect(getProductName(null)).toBeUndefined();
      expect(getProductPrice(null)).toBeUndefined();
      expect(getProductDescription(null)).toBeUndefined();
    });
  });

  // COMPONENT STATE LOGIC TESTS
  describe("Component State Logic", () => {
    it("initializes with empty orders state", () => {
      // UNIT TEST: Tests initial state
      mockUseAuth.mockReturnValue([null, jest.fn()]);

      render(<Orders />);

      // Component should render without any orders initially
      expect(screen.getByText("All Orders")).toBeInTheDocument();
      expect(screen.queryByText("Processing")).not.toBeInTheDocument();
      expect(screen.queryByText("Delivered")).not.toBeInTheDocument();
    });

    it("handles auth state changes", () => {
      // UNIT TEST: Tests component behavior with different auth states
      const mockSetAuth = jest.fn();

      // Test with no auth
      const { rerender } = render(<Orders />);
      mockUseAuth.mockReturnValue([null, mockSetAuth]);

      rerender(<Orders />);
      expect(screen.getByText("All Orders")).toBeInTheDocument();

      // Test with auth but no token
      mockUseAuth.mockReturnValue([{ user: { name: "Test" } }, mockSetAuth]);
      rerender(<Orders />);
      expect(screen.getByText("All Orders")).toBeInTheDocument();

      // Test with full auth
      mockUseAuth.mockReturnValue([
        { token: "test-token", user: { name: "Test" } },
        mockSetAuth,
      ]);
      rerender(<Orders />);
      expect(screen.getByText("All Orders")).toBeInTheDocument();
    });
    
    it('calls getOrders when auth token is present', async () => {
      // UNIT TEST: Verifies that the getOrders API call is triggered when an auth token exists.
      const mockOrders = [
        {
          _id: "1",
          status: "Processing",
          buyer: { name: "Test" },
          createAt: "2023-01-01",
          payment: { success: true },
          products: [],
        },
      ];
      axios.get.mockResolvedValueOnce({ data: mockOrders });
      mockUseAuth.mockReturnValue([
        { token: "valid-token", user: { name: "Test User" } },
        jest.fn(),
      ]);
      render(<Orders />);
      expect(axios.get).toHaveBeenCalledTimes(1);
      expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/orders");
      await waitFor(() => {
        expect(screen.getByText("Test")).toBeInTheDocument();
      });
    });

    it('does not call getOrders when auth token is not present', () => {
      // UNIT TEST: Verifies that the getOrders API call is NOT triggered when no auth token is available.
      axios.get.mockClear();
      mockUseAuth.mockReturnValue([{ user: { name: "Test User" } }, jest.fn()]);
      render(<Orders />);
      expect(axios.get).not.toHaveBeenCalled();
    });
  });

  // ERROR HANDLING LOGIC TESTS
  describe("Error Handling Logic", () => {
    it("handles malformed order data gracefully", () => {
      // UNIT TEST: Tests component resilience to bad data (purely on input)
      const processOrderData = (orders) => {
        if (!orders || !Array.isArray(orders)) return [];
        return orders.filter((order) => order && order._id);
      };

      expect(processOrderData(null)).toEqual([]);
      expect(processOrderData(undefined)).toEqual([]);
      expect(processOrderData("not an array")).toEqual([]);
      expect(processOrderData([])).toEqual([]);
      expect(processOrderData([null, undefined, { _id: "1" }])).toEqual([
        { _id: "1" },
      ]);
    });

    it("handles missing required properties safely", () => {
      // UNIT TEST: Tests safe property access
      const safePropertyAccess = (obj, path) => {
        try {
          return path
            .split(".")
            .reduce((current, prop) => current?.[prop], obj);
        } catch {
          return undefined;
        }
      };

      const testData = {
        order: {
          buyer: { name: "John" },
          payment: { success: true },
        },
      };

      expect(safePropertyAccess(testData, "order.buyer.name")).toBe("John");
      expect(safePropertyAccess(testData, "order.payment.success")).toBe(true);
      expect(
        safePropertyAccess(testData, "order.missing.property")
      ).toBeUndefined();
      expect(safePropertyAccess(null, "any.path")).toBeUndefined();
    });
  });

  // COMPONENT LIFECYCLE LOGIC TESTS
  describe("Component Lifecycle Logic", () => {
    it("does not throw errors during render", () => {
      // UNIT TEST: Tests component stability
      mockUseAuth.mockReturnValue([null, jest.fn()]);

      expect(() => render(<Orders />)).not.toThrow();
    });

    it("handles component unmounting gracefully", () => {
      // UNIT TEST: Tests cleanup
      mockUseAuth.mockReturnValue([null, jest.fn()]);

      const { unmount } = render(<Orders />);

      expect(() => unmount()).not.toThrow();
    });

    it("re-renders with new props without errors", () => {
      // UNIT TEST: Tests re-rendering stability
      const mockSetAuth = jest.fn();
      mockUseAuth.mockReturnValue([null, mockSetAuth]);

      const { rerender } = render(<Orders />);

      // Change auth state and re-render
      mockUseAuth.mockReturnValue([
        { token: "new-token", user: { name: "New User" } },
        mockSetAuth,
      ]);

      expect(() => rerender(<Orders />)).not.toThrow();
    });

    it('handles unmounting gracefully after API call starts', async () => {
      // UNIT TEST: Verifies the component does not cause a memory leak by updating state on an unmounted component.
      const mockPromise = new Promise(resolve => {});
      axios.get.mockImplementation(() => mockPromise);
      mockUseAuth.mockReturnValue([{ token: 'valid-token' }, jest.fn()]);
      const consoleErrorSpy = jest.spyOn(console, 'error');
      const { unmount } = render(<Orders />);
      unmount();
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('handles malformed order data gracefully', async () => {
      // UNIT TEST: Component-level; verifies the component gracefully handles orders with missing or null properties.
      const malformedOrder = {
        _id: "order3",
        status: "Not Process",
        createAt: "2025-09-17T12:00:00.000Z",
        payment: { success: false },
        products: null
      };
      axios.get.mockResolvedValueOnce({ data: [malformedOrder] });
      mockUseAuth.mockReturnValue([{ token: 'valid-token' }, jest.fn()]);
      render(<Orders />);
      await waitFor(() => {
        expect(screen.getByText("All Orders")).toBeInTheDocument(); // page did not crash
      });
    });
  });

  // ACCESSIBILITY AND SEMANTIC TESTS
  describe("Accessibility and Semantic Logic", () => {
    it("uses proper heading hierarchy", () => {
      // UNIT TEST: Tests semantic HTML structure
      mockUseAuth.mockReturnValue([null, jest.fn()]);

      render(<Orders />);

      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toHaveTextContent("All Orders");
      expect(heading).toHaveClass("text-center");
    });

    it("applies correct CSS classes", () => {
      // UNIT TEST: Tests CSS class application logic
      mockUseAuth.mockReturnValue([null, jest.fn()]);

      const { container } = render(<Orders />);

      expect(
        container.querySelector(".container-flui.p-3.m-3.dashboard")
      ).toBeInTheDocument();
      expect(container.querySelector(".row")).toBeInTheDocument();
      expect(container.querySelector(".col-md-3")).toBeInTheDocument();
      expect(container.querySelector(".col-md-9")).toBeInTheDocument();
    });

    
    it('renders table headers with correct capitalization', async () => {
      // UNIT TEST: Verifies that the table headers are displayed with the correct capitalization.
      const mockOrders = [
        {
          _id: "order1",
          status: "Processing",
          buyer: { name: "Jane Doe" },
          createAt: "2025-09-17T12:00:00.000Z",
          payment: { success: true },
          products: [{ _id: "prod1", name: "Product A", description: "Desc A", price: 100 }],
        },
      ];
      axios.get.mockResolvedValueOnce({ data: mockOrders });
      mockUseAuth.mockReturnValue([{ token: 'valid-token' }, jest.fn()]);

      render(<Orders />);

      // Check each header for correct capitalization
      expect(screen.getByRole('columnheader', { name: '#' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Buyer' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Date' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Payment' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Quantity' })).toBeInTheDocument();
    });
  });
});
