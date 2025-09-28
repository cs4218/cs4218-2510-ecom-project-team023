// Some tests written with help of AI
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/extend-expect";
import UserMenu from "./UserMenu";

const renderMenu = (initialPath = "/") =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <UserMenu />
    </MemoryRouter>
  );

describe("UserMenu", () => {
  test("renders heading", () => {
    renderMenu();
    expect(screen.getByRole("heading", { name: /dashboard/i })).toBeInTheDocument();
  });

  test("renders Profile link with correct href", () => {
    renderMenu();
    const link = screen.getByRole("link", { name: /profile/i });
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("/dashboard/user/profile")
    );
    expect(link).toHaveClass("list-group-item", "list-group-item-action");
  });

  test("renders Orders link with correct href", () => {
    renderMenu();
    const link = screen.getByRole("link", { name: /orders/i });
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("/dashboard/user/orders")
    );
    expect(link).toHaveClass("list-group-item", "list-group-item-action");
  });

  test("marks Profile as active when on /dashboard/user/profile", () => {
    renderMenu("/dashboard/user/profile");
    const active = screen.getByRole("link", { name: /profile/i });
    expect(active).toHaveAttribute("aria-current", "page");
    // and Orders is not active
    expect(screen.getByRole("link", { name: /orders/i })).not.toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  test("marks Orders as active when on /dashboard/user/orders", () => {
    renderMenu("/dashboard/user/orders");
    const active = screen.getByRole("link", { name: /orders/i });
    expect(active).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /profile/i })).not.toHaveAttribute(
      "aria-current",
      "page"
    );
  });
});
