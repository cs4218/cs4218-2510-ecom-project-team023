// Some tests written with help of AI
// client/src/pages/admin/Products.test.js
import React from "react";
import axios from "axios";
import {
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import { MemoryRouter } from "react-router-dom";

// -------------------- Mocks (declare BEFORE requiring SUT) --------------------
jest.mock("axios");

// Mock Layout to expose title
jest.mock("../../components/Layout", () => {
  const React = require("react");
  const Layout = ({ children, title }) => (
    <div data-testid="layout" data-title={title}>
      {children}
    </div>
  );
  return { __esModule: true, default: Layout };
});

// Mock AdminMenu
jest.mock("../../components/AdminMenu", () => {
  const React = require("react");
  const AdminMenu = () => <nav data-testid="admin-menu" />;
  return { __esModule: true, default: AdminMenu };
});

// Mock toast
const mockToast = { success: jest.fn(), error: jest.fn() };
jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    success: (m) => mockToast.success(m),
    error: (m) => mockToast.error(m),
  },
}));

// -------------------- Require SUT AFTER mocks --------------------
const Products = require("./Products").default;

// Helper: render with router so <Link> works
const renderWithRouter = (ui) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

beforeEach(() => {
  jest.clearAllMocks();
});

// -------------------- Tests --------------------

test("renders Layout title, AdminMenu, and default products payload", async () => {
  axios.get.mockResolvedValueOnce({
    data: {
      products: [
        { _id: "p1", slug: "one", name: "One", description: "First" },
        { _id: "p2", slug: "two", name: "Two", description: "Second" },
      ],
    },
  });

  renderWithRouter(<Products />);

  const layout = await screen.findByTestId("layout");
  expect(layout).toHaveAttribute("data-title", "Dashboard - Products");
  expect(screen.getByTestId("admin-menu")).toBeInTheDocument();

  // Wait for products from default shape { products: [...] }
  expect(await screen.findByText("One")).toBeInTheDocument();
  expect(screen.getByText("Two")).toBeInTheDocument();

  // Links & images
  const img1 = screen.getByAltText("One");
  const img2 = screen.getByAltText("Two");
  expect(img1).toHaveAttribute("src", "/api/v1/product/product-photo/p1");
  expect(img2).toHaveAttribute("src", "/api/v1/product/product-photo/p2");

  // anchor hrefs (MemoryRouter renders proper <a>)
  expect(
    screen.getByRole("link", { name: /One/i })
  ).toHaveAttribute("href", "/dashboard/admin/product/one");
  expect(
    screen.getByRole("link", { name: /Two/i })
  ).toHaveAttribute("href", "/dashboard/admin/product/two");
});

test("handles { success:true, data:[...] } response shape (covers 18–20)", async () => {
  axios.get.mockResolvedValueOnce({
    data: {
      success: true,
      data: [
        { _id: "a1", slug: "alt-one", name: "Alt One", description: "A1" },
        { _id: "a2", slug: "alt-two", name: "Alt Two", description: "A2" },
      ],
    },
  });

  renderWithRouter(<Products />);

  // IMPORTANT: wait for async render
  expect(await screen.findByText("Alt One")).toBeInTheDocument();
  expect(await screen.findByText("Alt Two")).toBeInTheDocument();

  const img1 = screen.getByAltText("Alt One");
  const img2 = screen.getByAltText("Alt Two");
  expect(img1).toHaveAttribute("src", "/api/v1/product/product-photo/a1");
  expect(img2).toHaveAttribute("src", "/api/v1/product/product-photo/a2");

  expect(
    screen.getByRole("link", { name: /Alt One/i })
  ).toHaveAttribute("href", "/dashboard/admin/product/alt-one");
  expect(
    screen.getByRole("link", { name: /Alt Two/i })
  ).toHaveAttribute("href", "/dashboard/admin/product/alt-two");
});

test("unknown shape -> sets empty array and shows 'No products yet.' (covers 21–22)", async () => {
  // Backend returns unexpected shape; component should fall back to []
  axios.get.mockResolvedValueOnce({ data: { foo: "bar" } });

  renderWithRouter(<Products />);

  expect(
    await screen.findByText("No products yet.")
  ).toBeInTheDocument();
});

test("catch branch: toasts 'Something Went Wrong' and logs", async () => {
  const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  axios.get.mockRejectedValueOnce(new Error("boom"));

  renderWithRouter(<Products />);

  await waitFor(() => {
    expect(mockToast.error).toHaveBeenCalledWith("Something Went Wrong");
    expect(logSpy).toHaveBeenCalled();
  });

  logSpy.mockRestore();
});

test("image alt falls back to 'product' when name is missing", async () => {
  // products with missing/nullable names -> should use fallback "product"
  axios.get.mockResolvedValueOnce({
    data: {
      products: [
        { _id: "p3", slug: "no-name-1", description: "D1" },        // no name
        { _id: "p4", slug: "no-name-2", name: null, description: "D2" }, // null name
      ],
    },
  });

  // Use your helper if present:
  // renderWithRouter(<Products />);

  // Or inline MemoryRouter (works either way)
  const { MemoryRouter } = require("react-router-dom");
  const Products = require("./Products").default;
  const { render } = require("@testing-library/react");
  render(
    <MemoryRouter>
      <Products />
    </MemoryRouter>
  );

  // Wait for render and assert the fallback alt text is used
  const imgs = await screen.findAllByAltText("product");
  expect(imgs).toHaveLength(2);
  expect(imgs[0]).toHaveAttribute("src", "/api/v1/product/product-photo/p3");
  expect(imgs[1]).toHaveAttribute("src", "/api/v1/product/product-photo/p4");
});
