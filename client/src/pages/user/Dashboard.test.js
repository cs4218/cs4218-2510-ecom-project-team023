// pages/user/Dashboard.test.jsx
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import Dashboard from "./Dashboard";

// Stub UserMenu (avoid router concerns)
jest.mock("../../components/UserMenu", () => () => <div data-testid="user-menu" />);

// Stub Layout so we can assert the title and avoid Header/Footer/Helmet
jest.mock("../../components/Layout", () => {
  const React = require("react");
  const LayoutMock = ({ children, title }) => (
    <div data-testid="layout" data-title={title}>
      {children}
    </div>
  );
  return { __esModule: true, default: LayoutMock };
});

// Control auth state
jest.mock("../../context/auth", () => ({
  useAuth: jest.fn(),
}));

const { useAuth } = require("../../context/auth");

describe("Dashboard (user)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("wraps content with Layout and passes the expected title", () => {
    useAuth.mockReturnValue([{ user: { name: "Nora", email: "n@e.com", address: "SG" } }]);

    render(<Dashboard />);

    const layout = screen.getByTestId("layout");
    expect(layout).toBeInTheDocument();
    expect(layout).toHaveAttribute("data-title", "Dashboard - Ecommerce App");
  });

  test("renders UserMenu", () => {
    useAuth.mockReturnValue([{ user: { name: "Nora" } }]);

    render(<Dashboard />);

    expect(screen.getByTestId("user-menu")).toBeInTheDocument();
  });

  test("shows user details (name, email, address) from auth", () => {
    useAuth.mockReturnValue([
      { user: { name: "Alice", email: "alice@example.com", address: "10 Main St" } },
    ]);

    render(<Dashboard />);

    expect(screen.getByRole("heading", { level: 3, name: "Alice" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "alice@example.com" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "10 Main St" })).toBeInTheDocument();
  });

  test("renders three headings even when user is missing (graceful empty state)", () => {
    useAuth.mockReturnValue([{}]);

    const { container } = render(<Dashboard />);

    const h3s = container.querySelectorAll("h3");
    expect(h3s.length).toBe(3);
  });
});
