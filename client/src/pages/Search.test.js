import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import Search from "./Search";

const MOCK_PRODUCTS = [
  { _id: "p1", name: "Laptop X", description: "This is a super powerful gaming laptop with high-end graphics and CPU.", price: 2500 },
  { _id: "p2", name: "Mouse Y", description: "An ergonomic mouse.", price: 50 },
];

let mockValues = {
  results: [],
  keyword: "",
};
const mockSetValues = jest.fn();

jest.mock("../context/search", () => ({
  useSearch: () => [mockValues, mockSetValues],
}));

jest.mock("./../components/Layout", () => {
    return ({ children, title }) => (
        <div data-testid="layout-mock" data-title={title}>
            {children}
        </div>
    );
});

describe("Search Component Coverage", () => {
  beforeEach(() => {
    mockValues = { results: [], keyword: "" };
    jest.clearAllMocks();
  });

  test("1. Renders product details, correct count, and passes title to Layout when results are found", () => {
    // Set up mock with products
    mockValues.results = MOCK_PRODUCTS;

    render(<Search />);

    expect(screen.getByTestId("layout-mock")).toHaveAttribute("data-title", "Search results");

    expect(screen.getByText(`Found ${MOCK_PRODUCTS.length}`)).toBeInTheDocument();
    
    expect(screen.getByText("Laptop X")).toBeInTheDocument();
    expect(screen.getByText("Mouse Y")).toBeInTheDocument();

    expect(screen.getByText("$ 2500")).toBeInTheDocument();
    expect(screen.getByText("$ 50")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "More Details" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "ADD TO CART" })).toHaveLength(2);

    expect(screen.getByText("This is a super powerful gamin...")).toBeInTheDocument();
  });

  test("2. Renders 'No Products Found' message when no products are returned", () => {
    mockValues.results = [];

    render(<Search />);

    expect(screen.getByTestId("layout-mock")).toHaveAttribute("data-title", "Search results");
    
    expect(screen.getByText("No Products Found")).toBeInTheDocument();
    
    // Check that no product elements are rendered
    expect(screen.queryByText("Laptop X")).not.toBeInTheDocument();
    expect(screen.queryByText("Mouse Y")).not.toBeInTheDocument();
    expect(screen.queryByText("$ 2500")).not.toBeInTheDocument();
  });
});