// Some tests written with help of AI
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import AdminDashboard from "./AdminDashboard";

// Mock AdminMenu so we avoid NavLink/Router requirements
jest.mock("./../../components/AdminMenu", () => () => (
  <div data-testid="admin-menu" />
));

// Mock Layout to avoid Header/Footer/Helmet and to assert it wraps children
jest.mock("./../../components/Layout", () => {
  const React = require("react");
  const LayoutMock = ({ children }) => <div data-testid="layout">{children}</div>;
  return { __esModule: true, default: LayoutMock };
});

// Mock useAuth to control the returned user
jest.mock("../../context/auth", () => ({
  useAuth: jest.fn(),
}));

const { useAuth } = require("../../context/auth");

describe("AdminDashboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders admin info from auth", () => {
    useAuth.mockReturnValue([
      { user: { name: "Alice", email: "alice@example.com", phone: "12345678" } },
    ]);

    render(<AdminDashboard />);

    // Layout + menu are present
    expect(screen.getByTestId("layout")).toBeInTheDocument();
    expect(screen.getByTestId("admin-menu")).toBeInTheDocument();

    // Admin details
    expect(screen.getByText(/Admin Name\s*:\s*Alice/i)).toBeInTheDocument();
    expect(screen.getByText(/Admin Email\s*:\s*alice@example\.com/i)).toBeInTheDocument();
    expect(screen.getByText(/Admin Contact\s*:\s*12345678/i)).toBeInTheDocument();
  });

  test("renders headings even when user is missing", () => {
    useAuth.mockReturnValue([{}]);

    render(<AdminDashboard />);

    // Headings exist (values may be blank/undefined)
    expect(screen.getByText(/Admin Name\s*:/i)).toBeInTheDocument();
    expect(screen.getByText(/Admin Email\s*:/i)).toBeInTheDocument();
    expect(screen.getByText(/Admin Contact\s*:/i)).toBeInTheDocument();
  });
});
