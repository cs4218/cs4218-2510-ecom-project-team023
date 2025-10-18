// client/src/pages/Search.test.js
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom"; // modern import
import Search from "./Search";

/* -------------------- Mocks -------------------- */
// useSearch -> control results & keyword from tests
let mockValues = { results: [], keyword: "" };
const mockSetValues = jest.fn();
jest.mock("../context/search", () => ({
  useSearch: () => [mockValues, mockSetValues],
}));

// useCart -> avoid touching real localStorage in tests when not needed
const mockSetCart = jest.fn();
jest.mock("../context/cart", () => ({
  useCart: () => [[], mockSetCart],
}));

// toast -> avoid real toasts in DOM
jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
  success: jest.fn(),
  error: jest.fn(),
}));

// useNavigate -> noop to avoid Router requirements (we don't click in these tests)
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

// Layout -> simple wrapper exposing title via data attribute so we can assert it
jest.mock("./../components/Layout", () => {
  return ({ children, title }) => (
    <div data-testid="layout-mock" data-title={title}>
      {children}
    </div>
  );
});

/* -------------------- Fixtures -------------------- */
const MOCK_PRODUCTS = [
  {
    _id: "p1",
    name: "Laptop X",
    description:
      "This is a super powerful gaming laptop with high-end graphics and CPU.",
    price: 2500,
    slug: "laptop-x",
  },
  {
    _id: "p2",
    name: "Mouse Y",
    description: "An ergonomic mouse.",
    price: 50,
    slug: "mouse-y",
  },
];

/* -------------------- Tests -------------------- */
describe("Search Component Coverage", () => {
  beforeEach(() => {
    mockValues = { results: [], keyword: "" };
    jest.clearAllMocks();
  });

  test("1. Renders product details, correct count, and passes title to Layout when results are found", () => {
    // Arrange
    mockValues.results = MOCK_PRODUCTS;

    // Act
    render(<Search />);

    // Assert layout title (component uses "Search Results")
    expect(screen.getByTestId("layout-mock")).toHaveAttribute(
      "data-title",
      "Search Results"
    );

    // Assert count
    expect(screen.getByText(`Found ${MOCK_PRODUCTS.length}`)).toBeInTheDocument();

    // Product names
    expect(screen.getByText("Laptop X")).toBeInTheDocument();
    expect(screen.getByText("Mouse Y")).toBeInTheDocument();

    // Prices — component renders "Price: $<num>"
    expect(screen.getByText("Price: $2500")).toBeInTheDocument();
    expect(screen.getByText("Price: $50")).toBeInTheDocument();

    // Buttons present for each card
    expect(screen.getAllByRole("button", { name: "More Details" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "ADD TO CART" })).toHaveLength(2);

    // Truncated description (first 30 chars + "...")
    // "This is a super powerful gamin" (30) + "..."
    expect(
      screen.getByText("This is a super powerful gamin...")
    ).toBeInTheDocument();
  });

  test("2. Renders 'No Products Found' message when no products are returned", () => {
    // Arrange
    mockValues.results = [];

    // Act
    render(<Search />);

    // Assert layout title
    expect(screen.getByTestId("layout-mock")).toHaveAttribute(
      "data-title",
      "Search Results"
    );

    // Empty state
    expect(screen.getByText("No Products Found")).toBeInTheDocument();

    // No product-specific content
    expect(screen.queryByText("Laptop X")).not.toBeInTheDocument();
    expect(screen.queryByText("Mouse Y")).not.toBeInTheDocument();
    expect(screen.queryByText("Price: $2500")).not.toBeInTheDocument();
    expect(screen.queryByText("Price: $50")).not.toBeInTheDocument();
  });
});
