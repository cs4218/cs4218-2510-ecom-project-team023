// Tests are written with the help of AI
import React from "react";
import { render, screen, waitFor, cleanup, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import axios from "axios";
import AdminOrders from "./AdminOrders";

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

jest.mock("react-router-dom", () => ({
  MemoryRouter: ({ children }) => (
    <div data-testid="memory-router">{children}</div>
  ),
}));

// Mock antd Select so we can click options and trigger onChange
jest.mock("antd", () => {
  const React = require("react");
  const Select = ({ defaultValue, onChange, children }) => (
    <div role="listbox" aria-label="order-status" data-default={defaultValue}>
      <div data-testid="status-options">
        {React.Children.map(children, (child) => {
          if (!child) return null;
          const { value, children: label } = child.props || {};
          return (
            <button type="button" onClick={() => onChange?.(value)}>
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
  const Option = ({ children }) => <>{children}</>;
  Select.Option = Option;
  return { __esModule: true, Select, Option };
});


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
describe("AdminOrders Component - Unit Tests Only", () => {
  const mockUseAuth = require("../../context/auth").useAuth;

  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  beforeEach(() => {
    axios.get.mockResolvedValue({ data: [] });
  });

  // RENDERING LOGIC TESTS
  describe("Component Rendering Logic", () => {
    it("renders basic component structure", () => {
      // UNIT TEST: Tests only JSX structure rendering
      mockUseAuth.mockReturnValue([null, jest.fn()]);

      render(<AdminOrders />);

      expect(screen.getByTestId("layout")).toBeInTheDocument();
      expect(screen.getByTestId("layout-title")).toHaveTextContent(
        "All Orders Data"
      );
      expect(screen.getByTestId("admin-menu")).toBeInTheDocument();
      expect(screen.getByText("All Orders")).toBeInTheDocument();
    });

    it("renders dashboard container structure", () => {
      // UNIT TEST: Tests layout
      mockUseAuth.mockReturnValue([null, jest.fn()]);

      const { container } = render(<AdminOrders />);

      expect(
        container.querySelector(".row.dashboard")
      ).toBeInTheDocument();
      expect(container.querySelector(".dashboard")).toBeInTheDocument();
      expect(container.querySelector(".row")).toBeInTheDocument();
      expect(container.querySelector(".col-md-3")).toBeInTheDocument();
      expect(container.querySelector(".col-md-9")).toBeInTheDocument();
    });

    it("renders empty state when no orders", async () => {
      // UNIT TEST: Tests rendering with empty orders array
      axios.get.mockResolvedValue({ data: [] });
      mockUseAuth.mockReturnValue([
        { token: "test-token", user: { name: "Test", role: 1} },
        jest.fn(),
      ]);

      render(<AdminOrders />);

      await waitFor(() => {
        expect(
          screen.getByText("No orders yet.")
        ).toBeInTheDocument();
      });
    });
  });

  // CONDITIONAL RENDERING TESTS
  describe("Conditional Rendering Logic", () => {
    it("renders without calling useEffect when no auth token", () => {
      // UNIT TEST: Tests conditional logic for auth token
      const mockSetAuth = jest.fn();
      mockUseAuth.mockReturnValue([{ user: { name: "Test", role: 1 } }, mockSetAuth]);

      render(<AdminOrders />);

      expect(screen.getByText("All Orders")).toBeInTheDocument();
      expect(screen.getByTestId("layout")).toBeInTheDocument();
    });

    it("renders with auth token present", async () => {
      // UNIT TEST: Tests rendering when auth token exists
      const mockSetAuth = jest.fn();
      mockUseAuth.mockReturnValue([
        { token: "valid-token", user: { name: "Test User", role: 1 } },
        mockSetAuth,
      ]);

      render(<AdminOrders />);

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(1);
      });
      expect(screen.getByText("All Orders")).toBeInTheDocument();
      expect(screen.getByTestId("admin-menu")).toBeInTheDocument();
    });

    it("handles null auth state gracefully", () => {
      // UNIT TEST: Tests null safety in component
      mockUseAuth.mockReturnValue([null, jest.fn()]);

      render(<AdminOrders />);

      expect(screen.getByText("All Orders")).toBeInTheDocument();
    });

    it("handles undefined auth state gracefully", () => {
      // UNIT TEST: Tests undefined safety in component
      mockUseAuth.mockReturnValue([undefined, jest.fn()]);

      render(<AdminOrders />);

      expect(screen.getByText("All Orders")).toBeInTheDocument();
    });
  });

  // DATA DISPLAY LOGIC TESTS
  describe("Order Display Logic", () => {
    beforeEach(() => {
      // Mock successful auth for these tests
      mockUseAuth.mockReturnValue([
        { token: "test-token", user: { name: "Test", role: 1 } },
        jest.fn(),
      ]);
    });

    it("renders table headers with correctly, with correct capitalization", async () => {
      // UNIT TEST: Verifies that the table headers are displayed with the correct capitalization.
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
              name: "Product A",
              description: "Desc A",
              price: 100,
            },
          ],
        },
      ];
      axios.get.mockResolvedValueOnce({ data: mockOrders });
      mockUseAuth.mockReturnValue([{ token: "valid-token" }, jest.fn()]);

      render(<AdminOrders />);

      await waitFor(() => {
        expect(
          screen.getByRole("columnheader", { name: "#" })
        ).toBeInTheDocument();
        expect(
          screen.getByRole("columnheader", { name: "Status" })
        ).toBeInTheDocument();
        expect(
          screen.getByRole("columnheader", { name: "Buyer" })
        ).toBeInTheDocument();
        expect(
          screen.getByRole("columnheader", { name: "Date" })
        ).toBeInTheDocument();
        expect(
          screen.getByRole("columnheader", { name: "Payment" })
        ).toBeInTheDocument();
        expect(
          screen.getByRole("columnheader", { name: "Quantity" })
        ).toBeInTheDocument();
      });
    });

    it("renders order details and products correctly from mock data", async () => {
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
              description: "A very detailed description for product A",
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

      render(<AdminOrders />);

      await waitFor(() => {
        expect(screen.getByText("Processing")).toBeInTheDocument();
        expect(screen.getByText("Jane Doe")).toBeInTheDocument();
        expect(screen.getByText("Success")).toBeInTheDocument();
        expect(screen.getByText("Test Product A")).toBeInTheDocument();
        expect(
          screen.getByText("A very detailed description fo") // ok to be truncated
        ).toBeInTheDocument();
        expect(screen.getByText("Price : 150")).toBeInTheDocument();
      });
    });

    it("should filter out and not render orders with missing core properties", async () => {
      // UNIT TEST: Orders data integrity (.filter() logic) for proper handling of malformed data to prevent crashes.
      const mockOrders = [
        {
          // Valid order
          _id: "order1",
          status: "Shipped",
          buyer: { name: "Alice" },
          payment: { success: true },
          products: [
            {
              _id: "prod1",
              name: "Product A",
              description: "Desc A",
              price: 10,
            },
          ],
        },
        {
          _id: "order2",
          status: null,
          buyer: { name: "Bob" },
          payment: { success: true },
          products: [],
        }, // Invalid: null status
        {
          _id: "order3",
          status: "Processing",
          buyer: null,
          payment: { success: true },
          products: [],
        }, // Invalid: null buyer
        null, // Invalid: null order object
        {
          // Valid order
          _id: "order4",
          status: "Processing",
          buyer: { name: "Charlie" },
          payment: { success: false },
          products: [
            {
              _id: "prod2",
              name: "Product B",
              description: "Desc B",
              price: 20,
            },
          ],
        },
      ];

      axios.get.mockResolvedValue({ data: mockOrders });

      render(<AdminOrders />);

      await waitFor(() => {
        // Assert that only valid orders are rendered
        expect(screen.getByText("Alice")).toBeInTheDocument();
        expect(screen.getByText("Charlie")).toBeInTheDocument();

        // Assert that invalid orders are not rendered
        expect(screen.queryByText("Bob")).not.toBeInTheDocument();
        expect(screen.queryByRole("row", { name: /order2/i })).toBeNull();
        expect(screen.queryByRole("row", { name: /order3/i })).toBeNull();
      });
    });

    // Partition: Payment Status
    describe("Payment Status Display", () => {
      const baseOrder = {
        _id: "order1",
        status: "Processing",
        buyer: { name: "Test Buyer" },
        products: [],
      };

      it("should display 'Success' for payment.success = true", async () => {
        axios.get.mockResolvedValue({
          data: [{ ...baseOrder, payment: { success: true } }],
        });

        render(<AdminOrders />);

        await waitFor(() =>
          expect(screen.getByText("Success")).toBeInTheDocument()
        );
      });

      it("should display 'Failed' for payment.success = false", async () => {
        axios.get.mockResolvedValue({
          data: [{ ...baseOrder, payment: { success: false } }],
        });

        render(<AdminOrders />);

        await waitFor(() =>
          expect(screen.getByText("Failed")).toBeInTheDocument()
        );
      });

      it("should display 'Failed' when payment object is missing the success property", async () => {
        axios.get.mockResolvedValue({ data: [{ ...baseOrder, payment: {} }] });

        render(<AdminOrders />);

        await waitFor(() =>
          expect(screen.getByText("Failed")).toBeInTheDocument()
        );
      });
    });

    // Partition: Product Quantity
    describe("Product Quantity Display", () => {
      const baseOrder = {
        _id: "order1",
        status: "Processing",
        buyer: { name: "Test Buyer" },
        payment: { success: true },
      };
      const fakeProduct = {
        _id: "prod",
        name: "Product A",
        description: "Desc A",
        price: 100,
      };

      it("should display quantity 0 for an empty products array", async () => {
        // UNIT TEST: Verifies that products is counted as 0 if empty
        axios.get.mockResolvedValue({ data: [{ ...baseOrder, products: [] }] });

        render(<AdminOrders />);

        const quantityCell = await screen.findByRole("cell", { name: 0 });
        expect(quantityCell).toBeInTheDocument();
      });

      it("should display quantity 1 for a product in array", async () => {
        // UNIT TEST: Verifies that products is counted if not empty
        const products = [{ ...fakeProduct, _id: "prod1" }];
        axios.get.mockResolvedValue({
          data: [{ ...baseOrder, products }],
        });

        render(<AdminOrders />);

        const cells = await screen.findAllByRole("cell", { name: 1 });

        // Note: This is brittle. If the table structure changes, this test breaks,
        // as it looks into the table strcuture (the Quantity column).
        expect(cells[1]).toBeInTheDocument();
      });

      it("should display the appropriate quantity for products in the array", async () => {
        // UNIT TEST: Verifies that the count is for elements within the array
        const products = [
          { ...fakeProduct, _id: "prod1" },
          { ...fakeProduct, _id: "prod2" },
          { ...fakeProduct, _id: "prod3" },
        ];
        axios.get.mockResolvedValue({ data: [{ ...baseOrder, products }] });

        render(<AdminOrders />);

        const quantityCell = await screen.findByRole("cell", { name: 3 });
        expect(quantityCell).toBeInTheDocument();
      });
    });
  });

  // DATA TRANSFORMATION LOGIC TESTS - Properties of Order
  describe("Data Transformation Logic", () => {
    // Test individual logic pieces that are in the component
    it("calculates order number correctly", () => {
      // UNIT TEST: Tests order numbering logic (i + 1)
      const calculateOrderNumber = (index) => index + 1;

      const idx = calculateOrderNumber(0);

      expect(idx).toBe(1);
    });

    describe("transforms payment status correctly", () => {
      // UNIT TESTS: Test payment status transformation
      const formatPaymentStatus = (payment) =>
        payment?.success ? "Success" : "Failed";

      it.each([
        {
          input: { success: true },
          expected: "Success",
          case: "successful payment",
        },
        {
          input: { success: false },
          expected: "Failed",
          case: "failed payment",
        },
        { input: null, expected: "Failed", case: "null payment object" },
        {
          input: undefined,
          expected: "Failed",
          case: "undefined payment object",
        },
        { input: {}, expected: "Failed", case: "empty payment object" },
      ])("should return '$expected' for $case", ({ input, expected }) => {
        // Act
        const result = formatPaymentStatus(input);

        // Assert
        expect(result).toBe(expected);
      });
    });

    describe("truncates description correctly", () => {
      // UNIT TESTS: Tests description truncation logic
      const truncateDescription = (desc, maxLength = 30) =>
        desc?.substring(0, maxLength) || "";

      // BVA
      const longDesc = "This is a very long description";
      const shortDesc = "This is a very long descripti";
      const fittedDesc = "This is a very long descriptio";
      const expectedFittedDesc = "This is a very long descriptio";

      it.each([
        {
          input: longDesc, // (31 chars)
          expected: expectedFittedDesc,
          case: "a long description",
        },
        {
          input: shortDesc, // (29 chars)
          expected: "This is a very long descripti",
          case: "a short description",
        },
        {
          input: fittedDesc, // (30 chars)
          expected: expectedFittedDesc,
          case: "a fitted description",
        },
        { input: "", expected: "", case: "an empty string" },
        { input: null, expected: "", case: "a null value" },
        { input: undefined, expected: "", case: "an undefined value" },
      ])("should correctly handle $case", ({ input, expected }) => {
        // Act
        const result = truncateDescription(input);

        // Assert
        expect(result).toBe(expected);
      });
    });

    // For the following, Null/undefined is ok as these rows will be omitted.
    describe("calculates product quantity correctly", () => {
      // UNIT TESTS: Tests products array length calculation
      const calculateQuantity = (products) => products?.length;

      it.each([
        { input: [], expected: 0, case: "an empty array" },
        { input: [{ id: 1 }], expected: 1, case: "an array with one item" },
        {
          input: [{ id: 1 }, { id: 2 }, { id: 3 }],
          expected: 3,
          case: "an array with multiple items",
        },
        { input: null, expected: undefined, case: "a null value" },
        { input: undefined, expected: undefined, case: "an undefined value" },
      ])("should return $expected for $case", ({ input, expected }) => {
        // Act
        const result = calculateQuantity(input);

        // Assert
        expect(result).toBe(expected);
      });
    });

    describe("handles optional chaining for buyer name", () => {
      // UNIT TESTS: Tests null safety for buyer?.name
      const getBuyerName = (buyer) => buyer?.name;

      it.each([
        {
          input: { name: "John Doe" },
          expected: "John Doe",
          case: "a valid buyer",
        },
        {
          input: {},
          expected: undefined,
          case: "a buyer with no name property",
        },
        { input: null, expected: undefined, case: "a null buyer" },
        { input: undefined, expected: undefined, case: "an undefined buyer" },
      ])("should return $expected for $case", ({ input, expected }) => {
        // Act
        const result = getBuyerName(input);

        // Assert
        expect(result).toBe(expected);
      });
    });

    describe("handles optional chaining for product properties", () => {
      // UNIT TESTS: Tests null safety for product properties
      // Arrange
      const getProductName = (product) => product?.name;
      const getProductPrice = (product) => product?.price;
      const getProductDescription = (product) => product?.description;

      const validProduct = {
        name: "Test Product",
        price: 99.99,
        description: "Test desc",
      };
      const emptyProduct = {};

      it("should return correct values for a valid product", () => {
        // Act & Assert
        expect(getProductName(validProduct)).toBe("Test Product");
        expect(getProductPrice(validProduct)).toBe(99.99);
        expect(getProductDescription(validProduct)).toBe("Test desc");
      });

      it("should return undefined for an empty product object", () => {
        // Act & Assert
        expect(getProductName(emptyProduct)).toBeUndefined();
        expect(getProductPrice(emptyProduct)).toBeUndefined();
        expect(getProductDescription(emptyProduct)).toBeUndefined();
      });

      it("should return undefined for a null product", () => {
        // Act & Assert
        expect(getProductName(null)).toBeUndefined();
        expect(getProductPrice(null)).toBeUndefined();
        expect(getProductDescription(null)).toBeUndefined();
      });
    });
  });

  // COMPONENT STATE LOGIC TESTS
  describe("Component State Logic", () => {
    it("initializes with empty orders state", () => {
      // UNIT TEST: Tests initial state
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
              name: "Product A",
              description: "Desc A",
              price: 100,
            },
          ],
        },
      ];
      axios.get.mockResolvedValueOnce({ data: mockOrders });
      mockUseAuth.mockReturnValue([null, jest.fn()]);

      render(<AdminOrders />);

      // Component should render without any orders initially
      expect(screen.getByText("All Orders")).toBeInTheDocument();
      expect(screen.queryByText("Processing")).not.toBeInTheDocument();
    });

    it("handles auth state changes", async () => {
      // UNIT TEST: Tests component behavior with different auth states
      const mockSetAuth = jest.fn();

      mockUseAuth.mockReturnValue([null, mockSetAuth]);
      const { rerender } = render(<AdminOrders />);
      expect(axios.get).not.toHaveBeenCalled(); // Assert only for initial state -  Verify no API call is made initially

      // Act: Rerender with a token, which triggers the useEffect
      mockUseAuth.mockReturnValue([
        { token: "test-token", user: { name: "Test", role: 1 } },
        mockSetAuth,
      ]);
      rerender(<AdminOrders />);

      // Target assertion
      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(1);
      });
    });

    it("calls getOrders when auth token is present", async () => {
      // UNIT TEST: Verifies that the correct getOrders API call is triggered when an auth token exists.
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
        { token: "valid-token", user: { name: "Test User", role: 1 } },
        jest.fn(),
      ]);

      render(<AdminOrders />);

      expect(axios.get).toHaveBeenCalledTimes(1);
      expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/all-orders");
      await waitFor(() => {
        expect(screen.getByText("Test")).toBeInTheDocument();
      });
    });

    it("does not call getOrders when auth token is not present", () => {
      // UNIT TEST: Verifies that the getOrders API call is NOT triggered when no auth token is available.
      mockUseAuth.mockReturnValue([{ user: { name: "Test User", role: 1 } }, jest.fn()]);

      render(<AdminOrders />);

      expect(axios.get).not.toHaveBeenCalled();
    });
  });

  // ERROR HANDLING LOGIC TESTS - Order
  describe("Error Handling Logic", () => {
    describe("handles missing required properties safely", () => {
      // Arrange
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

      // Testcases definition: [description, object, path, expectedOutput]
      const testCases = [
        ["a valid nested property", testData, "order.buyer.name", "John"],
        ["a valid boolean property", testData, "order.payment.success", true],
        [
          "a missing nested property",
          testData,
          "order.missing.property",
          undefined,
        ],
        ["a path on a null object", null, "any.path", undefined],
      ];

      it.each(testCases)(
        "should handle %s correctly",
        (description, obj, path, expected) => {
          // Act
          const result = safePropertyAccess(obj, path);

          // Assert
          expect(result).toBe(expected);
        }
      );
    });

    it("handles malformed order data gracefully - component level", async () => {
      // UNIT TEST: Component-level; verifies the component gracefully handles orders with missing or null properties.
      // Previously, page crashes as there was no filtering. With filtering, this testcase is just an added safety
      const malformedOrder = {
        _id: "order3",
        status: "Not Process",
        createAt: "2025-09-17T12:00:00.000Z",
        payment: { success: false },
        products: null,
      };
      axios.get.mockResolvedValueOnce({ data: [malformedOrder] });
      mockUseAuth.mockReturnValue([{ token: "valid-token" }, jest.fn()]);

      render(<AdminOrders />);

      await waitFor(() => {
        expect(screen.getByText("All Orders")).toBeInTheDocument(); // page did not crash
      });
    });

    it("should handle API errors gracefully and not display the order table", async () => {
      // UNIT TEst: Mock a network error or a 500 server error
      axios.get.mockRejectedValue(new Error("API Error"));
      const consoleSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => {});

      render(<AdminOrders />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
      });
      // The table should not be present
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
      expect(
        screen.getByText("No orders yet.") // An empty state message should be shown as a fallback
      ).toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });

  // COMPONENT LIFECYCLE LOGIC TESTS
  describe("Component Lifecycle Logic", () => {
    it("does not throw errors during render", () => {
      // UNIT TEST: Tests component stability
      mockUseAuth.mockReturnValue([null, jest.fn()]);

      const act = () => render(<AdminOrders />);

      expect(act).not.toThrow();
    });

    it("handles component unmounting gracefully", () => {
      // UNIT TEST: Tests cleanup
      mockUseAuth.mockReturnValue([null, jest.fn()]);

      const { unmount } = render(<AdminOrders />);

      expect(() => unmount()).not.toThrow();
    });

    it("handles unmounting gracefully after API call starts", async () => {
      // UNIT TEST: Verifies the component does not cause a memory leak by updating state on an unmounted component.
      const mockPromise = new Promise((resolve) => {});
      axios.get.mockImplementation(() => mockPromise);
      mockUseAuth.mockReturnValue([{ token: "valid-token" }, jest.fn()]);
      const consoleErrorSpy = jest.spyOn(console, "error");

      const { unmount } = render(<AdminOrders />);
      unmount();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(consoleErrorSpy).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  // ACCESSIBILITY AND SEMANTIC TESTS
  describe("Accessibility and Semantic Logic", () => {
    it("uses proper heading hierarchy", () => {
      // UNIT TEST: Tests semantic HTML structure
      mockUseAuth.mockReturnValue([null, jest.fn()]);

      render(<AdminOrders />);

      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toHaveTextContent("All Orders");
      expect(heading).toHaveClass("text-center");
    });

    it("applies correct CSS classes", () => {
      // UNIT TEST: Tests CSS class application logic
      mockUseAuth.mockReturnValue([null, jest.fn()]);

      const { container } = render(<AdminOrders />);

      expect(container.querySelector(".row.dashboard")).toBeInTheDocument();
      expect(container.querySelector(".row")).toBeInTheDocument();
      expect(container.querySelector(".col-md-3")).toBeInTheDocument();
      expect(container.querySelector(".col-md-9")).toBeInTheDocument();
    });
  });

  it("status change triggers PUT and refresh (covers lines 36–42 & 78)", async () => {
    const { useAuth } = require("../../context/auth");
    useAuth.mockReturnValue([
      { token: "valid-token", user: { name: "Admin", role: 1 } },
      jest.fn(),
    ]);

    const initialOrders = [
      {
        _id: "o1",
        status: "Processing",
        buyer: { name: "Buyer One" },
        updatedAt: "2025-01-01T00:00:00.000Z",
        payment: { success: true },
        products: [],
      },
    ];
    const refreshedOrders = [{ ...initialOrders[0], status: "Shipped" }];

    axios.get
      .mockResolvedValueOnce({ data: initialOrders })   // initial getOrders (useEffect)
      .mockResolvedValueOnce({ data: refreshedOrders }); // getOrders called inside handleChange

    axios.put.mockResolvedValueOnce({ data: { success: true } });

    render(<AdminOrders />);

    // Ensure initial row is rendered
    await screen.findByText("Buyer One");

    // Our Select mock exposes a listbox with data-default set to the current status
    const statusListbox = screen.getByRole("listbox", { name: "order-status" });
    expect(statusListbox).toHaveAttribute("data-default", "Processing");

    // Click "Shipped" -> triggers Select onChange (line 78) and handleChange (36–42)
    fireEvent.click(
      within(statusListbox.parentElement).getByRole("button", { name: "Shipped" })
    );

    await waitFor(() => {
      // PUT called with correct URL + payload (handleChange)
      expect(axios.put).toHaveBeenCalledWith(
        "/api/v1/auth/order-status/o1",
        { status: "Shipped" }
      );
      // getOrders called again after PUT
      expect(axios.get).toHaveBeenCalledTimes(2);
    });
  });

  it("status change error logs error and does not refresh orders (covers line 42 catch)", async () => {
    const { useAuth } = require("../../context/auth");
    useAuth.mockReturnValue([
      { token: "valid-token", user: { name: "Admin", role: 1 } },
      jest.fn(),
    ]);

    const initialOrders = [
      {
        _id: "o1",
        status: "Processing",
        buyer: { name: "Buyer One" },
        updatedAt: "2025-01-01T00:00:00.000Z",
        payment: { success: true },
        products: [],
      },
    ];

    // Initial load succeeds once
    axios.get.mockResolvedValueOnce({ data: initialOrders });
    // Status update fails -> hit catch on line 42
    axios.put.mockRejectedValueOnce(new Error("network fail"));

    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    render(<AdminOrders />);

    // Wait for initial table render
    await screen.findByText("Buyer One");

    // Interact with the mocked <Select> (line 78 onChange)
    const statusListbox = screen.getByRole("listbox", { name: "order-status" });
    fireEvent.click(
      within(statusListbox.parentElement).getByRole("button", { name: "Shipped" })
    );

    await waitFor(() => {
      // PUT was attempted
      expect(axios.put).toHaveBeenCalledWith(
        "/api/v1/auth/order-status/o1",
        { status: "Shipped" }
      );
      // catch {} ran -> console.log called (line 42)
      expect(consoleSpy).toHaveBeenCalled();
      // No refresh (getOrders) after failure
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    consoleSpy.mockRestore();
  });

});
