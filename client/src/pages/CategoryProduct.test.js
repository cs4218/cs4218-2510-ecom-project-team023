// client/src/pages/CategoryProduct.test.js
import React from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

/* ---------- Layout + CSS mocks ---------- */
jest.mock("../components/Layout", () => ({
  __esModule: true,
  default: ({ children }) => <div data-testid="layout">{children}</div>,
}));
jest.mock("../styles/CategoryProductStyles.css", () => ({}), { virtual: true });

/* ---------- axios mock ---------- */
jest.mock("axios", () => {
  const mock = { get: jest.fn() };
  return { __esModule: true, default: mock };
});
import axios from "axios";

/* ---------- react-router-dom mock ---------- */
let mockSlug = "phones";
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
import CategoryProduct from "./CategoryProduct";

/* ---------- Helpers ---------- */
const cat = (overrides = {}) => ({ _id: "c1", name: "Phones", ...overrides });
const prod = (overrides = {}) => ({
  _id: "p1",
  name: "Item 1",
  description: "Description 1",
  price: 100,
  slug: "item-1",
  ...overrides,
});
const prods = (n = 2) =>
  Array.from({ length: n }).map((_, i) =>
    prod({ _id: `p${i + 1}`, name: `Item ${i + 1}`, slug: `item-${i + 1}`, price: 100 + i })
  );

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockNavigate.mockReset();
  mockSlug = "phones";
});

/* ============================================================================
   1) Fetch by slug and render header/cards
   ========================================================================== */
test("fetches by slug and renders header, count, cards, and image src", async () => {
  axios.get.mockResolvedValueOnce({
    data: { category: cat(), products: prods(2) },
  });

  render(<CategoryProduct />);

  expect(await screen.findByText(/Category - Phones/i)).toBeInTheDocument();
  expect(screen.getByText(/2 result found/i)).toBeInTheDocument();

  expect(screen.getByText("Item 1")).toBeInTheDocument();
  expect(screen.getByText("Item 2")).toBeInTheDocument();

  const imgs = screen.getAllByRole("img");
  expect(imgs[0]).toHaveAttribute("src", "/api/v1/product/product-photo/p1");
  expect(imgs[1]).toHaveAttribute("src", "/api/v1/product/product-photo/p2");

  expect(axios.get).toHaveBeenCalledWith(
  "/api/v1/product/product-category/phones",
  expect.objectContaining({ signal: expect.any(Object) })
);
});

/* ============================================================================
   2) Navigate to product details
   ========================================================================== */
test("clicking 'More Details' navigates to /product/:slug", async () => {
  axios.get.mockResolvedValueOnce({
    data: { category: cat(), products: [prod({ slug: "gadget", name: "Gadget", _id: "p9" })] },
  });

  render(<CategoryProduct />);

  const btn = await screen.findByRole("button", { name: /More Details/i });
  fireEvent.click(btn);
  expect(mockNavigate).toHaveBeenCalledWith("/product/gadget");
});

/* ============================================================================
   3) Placeholder name before data arrives (regression)
   ========================================================================== */
test("shows placeholder name (—) before data resolves", async () => {
  const d = deferred();
  axios.get.mockReturnValueOnce(d.promise);

  render(<CategoryProduct />);

  expect(screen.getByText(/Category -/i)).toHaveTextContent("Category - —");

  await act(async () => {
    d.resolve({ data: { category: cat(), products: [] } });
  });
});

/* ============================================================================
   4) Clears old items on slug change (regression)
   ========================================================================== */
test("clears previous products immediately when slug changes", async () => {
  axios.get.mockResolvedValueOnce({
    data: { category: cat(), products: prods(2) },
  });

  const { rerender } = render(<CategoryProduct />);
  await screen.findByText("Item 2");

  const d2 = deferred();
  mockSlug = "laptops";
  axios.get.mockReturnValueOnce(d2.promise);
  rerender(<CategoryProduct />);

  expect(screen.queryByText("Item 1")).not.toBeInTheDocument();
  expect(screen.queryByText("Item 2")).not.toBeInTheDocument();

  await act(async () => {
    d2.resolve({
      data: {
        category: { _id: "c2", name: "Laptops" },
        products: [prod({ _id: "px", name: "Laptop X", slug: "laptop-x" })],
      },
    });
  });
  expect(screen.getByText("Laptop X")).toBeInTheDocument();
});

/* ============================================================================
   5) Ignores stale (out-of-order) responses (regression)
   ========================================================================== */
test("ignores late response from previous slug request", async () => {
  // First request (phones)
  const d1 = deferred();
  axios.get.mockReturnValueOnce(d1.promise);

  const { rerender } = render(<CategoryProduct />);

  // Change slug to laptops
  const d2 = deferred();
  mockSlug = "laptops";
  axios.get.mockReturnValueOnce(d2.promise);
  rerender(<CategoryProduct />);

  // Resolve second (newer) first
  await act(async () => {
    d2.resolve({
      data: {
        category: { name: "Laptops" },
        products: [prod({ name: "Laptop X", _id: "lx", slug: "laptop-x" })],
      },
    });
  });
  expect(screen.getByText("Laptop X")).toBeInTheDocument();

  // Now resolve first (older) response
  await act(async () => {
    d1.resolve({
      data: {
        category: { name: "Phones" },
        products: [prod({ name: "Phone A", _id: "pa", slug: "phone-a" })],
      },
    });
  });

  // UI should still show laptops, not phones
  expect(screen.getByText("Laptop X")).toBeInTheDocument();
  expect(screen.queryByText("Phone A")).not.toBeInTheDocument();
});

/* ============================================================================
   6) Price formatting guard (non-numeric → —)
   ========================================================================== */
test("renders — when price is non-numeric", async () => {
  axios.get.mockResolvedValueOnce({
    data: {
      category: cat(),
      products: [prod({ name: "Weird", price: "not-a-number" })],
    },
  });

  render(<CategoryProduct />);
  expect(await screen.findByText("Weird")).toBeInTheDocument();
  expect(screen.getByText("—")).toBeInTheDocument();
});
