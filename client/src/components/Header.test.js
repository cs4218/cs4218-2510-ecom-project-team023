// Some tests written with help of AI
// Header.test.jsx 
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/extend-expect";
import userEvent from "@testing-library/user-event";
import Header from "./Header";

// --- Mock navigation to avoid MemoryRouter state updates 
jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  const NoNavLink = ({ to, children, onClick, ...rest }) => (
    <a
      href={typeof to === "string" ? to : "#"}
      onClick={(e) => {
        e.preventDefault();
        if (onClick) onClick(e);
      }}
      {...rest}
    >
      {children}
    </a>
  );
  return {
    ...actual,
    useNavigate: () => jest.fn(), // swallow programmatic navigation
    Link: NoNavLink,              // prevent real navigation
    NavLink: NoNavLink,           // prevent real navigation
  };
});

jest.mock("react-hot-toast", () => ({ success: jest.fn() }));
jest.mock("../hooks/useCategory", () => jest.fn());
jest.mock("../context/auth", () => ({ useAuth: jest.fn() }));
jest.mock("../context/cart", () => ({ useCart: jest.fn() }));
jest.mock("./Form/SearchInput", () => () => <div />);

jest.mock("antd", () => ({
  Badge: ({ count, children }) => (
    <div data-testid="badge">
      <span data-testid="badge-count">{count}</span>
      {children}
    </div>
  ),
}));

Object.defineProperty(window, "localStorage", {
  value: { setItem: jest.fn(), getItem: jest.fn(), removeItem: jest.fn() },
  writable: true,
});

const useCategory = require("../hooks/useCategory");
const { useAuth } = require("../context/auth");
const { useCart } = require("../context/cart");

const renderHeader = () =>
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Header />
    </MemoryRouter>
  );

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.mockReturnValue([{ user: null, token: "" }, jest.fn()]);
  useCart.mockReturnValue([[]]);
  useCategory.mockReturnValue([]);
});

// 1) guest path
test("guest shows Register", () => {
  renderHeader();
  expect(screen.getByRole("link", { name: "Register" })).toBeInTheDocument();
});

// 2) user role 0
test("user routes to /dashboard/user", () => {
  useAuth.mockReturnValue([{ user: { name: "A", role: 0 }, token: "t" }, jest.fn()]);
  renderHeader();
  expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
    "href",
    "/dashboard/user"
  );
});

// 3) admin role 1 path
test("admin routes to /dashboard/admin", () => {
  useAuth.mockReturnValue([{ user: { name: "A", role: 1 }, token: "t" }, jest.fn()]);
  renderHeader();
  expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
    "href",
    "/dashboard/admin"
  );
});

// 4) categories undefined triggers categories?.map short-circuit
test("categories undefined renders only 'All Categories'", () => {
  useCategory.mockReturnValue(undefined);
  const { container } = renderHeader();
  const items = container.querySelectorAll("ul.dropdown-menu .dropdown-item");
  expect(items.length).toBe(1); // only All Categories
});

// 5) exercise slug ?? id ?? name ?? index branches (all in one render)
test("coalescing key branches: slug→id→name→index", () => {
  useCategory.mockReturnValue([
    { name: "HasSlug", slug: "has-slug" },
    { name: "HasIdOnly", id: "id-1", slug: undefined },
    { name: "HasNameOnly", slug: null, id: null },
    { slug: undefined, id: undefined, name: undefined }, // index fallback
  ]);
  const { container } = renderHeader();
  const items = container.querySelectorAll("ul.dropdown-menu .dropdown-item");
  expect(items.length).toBe(5);
});

// 6) cart undefined covers cart?.length false path
test("cart undefined leaves badge text empty", () => {
  useCart.mockReturnValue([undefined]);
  renderHeader();
  expect(screen.getByTestId("badge-count").textContent).toBe("");
});

// 7) logout triggers success toast (no router state update)
test("logout triggers success toast", async () => {
  const setAuth = jest.fn();
  useAuth.mockReturnValue([{ user: { name: "Bob", role: 0 }, token: "t" }, setAuth]);

  renderHeader();

  await userEvent.click(screen.getByRole("link", { name: "Logout" }));

  await waitFor(() =>
    expect(require("react-hot-toast").success).toHaveBeenCalledWith("Logout Successfully")
  );
});
