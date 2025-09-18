// client/src/pages/Categories.test.js
// list of jest tests written by chatgpt 4 and 5
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

/* ---------- Layout mock ---------- */
jest.mock("../components/Layout", () => ({
  __esModule: true,
  default: ({ children }) => <div data-testid="layout">{children}</div>,
}));

/* ---------- react-router-dom Link mock ---------- */
const linkClicks = [];
jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    Link: ({ to, children, ...rest }) => (
      <a
        data-testid={`link-${String(to)}`}
        href={to}
        onClick={(e) => linkClicks.push(to)}
        {...rest}
      >
        {children}
      </a>
    ),
  };
});

/* ---------- useCategory mock (controllable output) ---------- */
let mockCategories;
jest.mock("../hooks/useCategory", () => ({
  __esModule: true,
  default: () => mockCategories,
}));

/* ---------- Import after mocks ---------- */
import Categories from "./Categories";

beforeEach(() => {
  jest.clearAllMocks();
  mockCategories = undefined; // default to the problematic case
  linkClicks.length = 0;
});

/* ============================================================================
   1) REGRESSION: Should NOT crash when useCategory() is undefined
   - Current component calls categories.map(...) and will throw TypeError
   - After fix: guard with (useCategory() ?? [])
   ========================================================================== */
test("does not crash when useCategory() returns undefined", () => {
  expect(() => render(<Categories />)).not.toThrow();
});

/* ============================================================================
   2) REGRESSION: Shows an empty state when there are zero categories
   - Current component renders nothing (blank area)
   - After fix: render a small note (e.g., 'No categories yet.')
   ========================================================================== */
test("shows an empty state when there are no categories", () => {
  mockCategories = []; // zero items
  render(<Categories />);
  expect(
    screen.getByText(/No categories yet\.?/i)
  ).toBeInTheDocument();
});

/* ============================================================================
   3) REGRESSION: Category with missing slug should NOT render a broken link
   - Current component uses `/category/undefined`
   - After fix: fallback to "#" and mark aria-disabled
   ========================================================================== */
test("category missing slug does not produce /category/undefined", () => {
  mockCategories = [{ _id: "1", name: "No Slug Cat" }];

  render(<Categories />);
  const anchor = screen.getByRole("link", { name: "No Slug Cat" });
  expect(anchor).toHaveAttribute("href", "#");            // will FAIL now
  expect(anchor).toHaveAttribute("aria-disabled", "true"); // will FAIL now
});

/* ============================================================================
   4) REGRESSION: Category with missing name shows 'Untitled' fallback
   - Current component renders empty text
   - After fix: use c?.name ?? 'Untitled'
   ========================================================================== */
test("category missing name shows a readable fallback label", () => {
  mockCategories = [{ _id: "2", slug: "no-name" }];

  render(<Categories />);
  expect(screen.getByText("Untitled")).toBeInTheDocument();
  const a = screen.getByTestId("link-/category/no-name");
  expect(a).toHaveAttribute("href", "/category/no-name");
});

/* ============================================================================
   5) Happy path: valid categories render proper links
   - This should PASS even now
   ========================================================================== */
test("renders valid category links with correct hrefs and labels", () => {
  mockCategories = [
    { _id: "a1", name: "Phones", slug: "phones" },
    { _id: "a2", name: "Laptops", slug: "laptops" },
  ];

  render(<Categories />);

  expect(screen.getByTestId("layout")).toBeInTheDocument();

  const phones = screen.getByTestId("link-/category/phones");
  const laptops = screen.getByTestId("link-/category/laptops");

  expect(phones).toHaveTextContent("Phones");
  expect(phones).toHaveAttribute("href", "/category/phones");

  expect(laptops).toHaveTextContent("Laptops");
  expect(laptops).toHaveAttribute("href", "/category/laptops");
});
