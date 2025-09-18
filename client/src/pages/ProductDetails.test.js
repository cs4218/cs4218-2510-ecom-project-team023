// client/src/pages/ProductDetails.regression.test.jsx
// list of jest tests written by chatgpt Regression 2 and 4
import React from "react";
import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom";

/* ---------- Mock Layout & CSS ---------- */
jest.mock("../components/Layout", () => ({
  __esModule: true,
  default: ({ children }) => <div data-testid="layout">{children}</div>,
}));
jest.mock("../styles/ProductDetailsStyles.css", () => ({}), { virtual: true });

/* ---------- Mock axios ---------- */
jest.mock("axios", () => {
  const mock = { get: jest.fn() };
  return { __esModule: true, default: mock };
});
import axios from "axios";

/* ---------- Mock react-router-dom (params + navigate) ---------- */
let mockSlug = "macbook-pro";
const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ slug: mockSlug }),
    useNavigate: () => mockNavigate,
  };
});

/* ---------- Import after mocks ---------- */
import ProductDetails from "./ProductDetails";

/* ---------- Helpers ---------- */
const product = (overrides = {}) => ({
  _id: "p-main",
  name: "MacBook Pro",
  description: "Fast laptop",
  price: 1999,
  slug: "macbook-pro",
  category: { _id: "cat-1", name: "Laptops" },
  ...overrides,
});

const related = (overrides = {}) => ({
  _id: "r1",
  name: "Laptop Sleeve",
  description: "Protective sleeve",
  price: 39.99,
  slug: "laptop-sleeve",
  ...overrides,
});

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockNavigate.mockReset();
  mockSlug = "macbook-pro";
});

/* ============================================================================
   Happy path: loads product then related; renders details & related cards
   ========================================================================== */
test("loads product and related products; renders details", async () => {
  axios.get
    .mockResolvedValueOnce({ data: { product: product() } }) // get-product/:slug
    .mockResolvedValueOnce({ data: { products: [related(), related({ _id: "r2", name: "Dock" })] } }); // related

  render(<ProductDetails />);

  // Wait for main details
  expect(await screen.findByText(/Product Details/i)).toBeInTheDocument();
  expect(screen.getByText(/Name : MacBook Pro/)).toBeInTheDocument();
  expect(screen.getByText(/Description : Fast laptop/)).toBeInTheDocument();
  expect(screen.getByText(/Category : Laptops/)).toBeInTheDocument();

  // Related show up
  expect(await screen.findByText("Laptop Sleeve")).toBeInTheDocument();
  expect(screen.getByText("Dock")).toBeInTheDocument();

  // Endpoints called correctly
  expect(axios.get).toHaveBeenNthCalledWith(1, "/api/v1/product/get-product/macbook-pro");
  expect(axios.get).toHaveBeenNthCalledWith(2, "/api/v1/product/related-product/p-main/cat-1");
});

/* ============================================================================
   REGRESSION 1: related product WITHOUT price should not crash
   - Current code calls p.price.toLocaleString(...) and throws when price is undefined
   - After fix: render a fallback (e.g., '—') or skip price
   ========================================================================== */
test("does not crash when a related product has undefined price (renders fallback)", async () => {
  axios.get
    .mockResolvedValueOnce({ data: { product: product() } })
    .mockResolvedValueOnce({ data: { products: [related({ price: undefined })] } });

  render(<ProductDetails />);

  expect(await screen.findByText("Laptop Sleeve")).toBeInTheDocument();

});

/* ============================================================================
   REGRESSION 2: related product WITHOUT description should not crash
   - Current code calls p.description.substring(0, 60) and throws when undefined
   - After fix: use (p.description ?? "").substring(...)
   ========================================================================== */
test("does not crash when a related product has undefined description (renders with fallback)", async () => {
  axios.get
    .mockResolvedValueOnce({ data: { product: product() } })
    .mockResolvedValueOnce({ data: { products: [related({ description: undefined })] } });

  render(<ProductDetails />);

  expect(await screen.findByText("Laptop Sleeve")).toBeInTheDocument();
});

/* ============================================================================
   REGRESSION 3 (brittle call): product returned without category should not
   attempt to access category._id (and should not crash)
   - Current code reads data.product.category._id directly; it's inside try/catch so
     it won't crash the app, but it's brittle. We assert no second call happens.
   ========================================================================== */
test("if product has no category, it should not try to fetch related (no second axios call)", async () => {
  axios.get.mockResolvedValueOnce({ data: { product: product({ category: undefined }) } });

  render(<ProductDetails />);

  // Wait for the main details to settle
  expect(await screen.findByText(/Product Details/i)).toBeInTheDocument();

  // Only one axios call (get-product), no related-product call
  expect(axios.get).toHaveBeenCalledTimes(1);

  // "No Similar Products found" should show (relatedProducts remains [])
  expect(screen.getByText(/No Similar Products found/i)).toBeInTheDocument();
});

/* ============================================================================
   REGRESSION 4 (optional): related price non-numeric should not crash
   - If backend returns a string price, toLocaleString on a string is legal but not currency-formatted.
     You may choose to coerce or show a fallback; keep this as a safety net if you decide to guard.
   ========================================================================== */
test("non-numeric related price does not break rendering (optional guard)", async () => {
  axios.get
    .mockResolvedValueOnce({ data: { product: product() } })
    .mockResolvedValueOnce({ data: { products: [related({ price: "not-a-number" })] } });

  render(<ProductDetails />);

  // Should still render name; you can choose to show '—' for non-numeric in your fix.
  expect(await screen.findByText("Laptop Sleeve")).toBeInTheDocument();
});
