// Some tests written with help of AI
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/extend-expect";
import AdminMenu from "./AdminMenu";

const renderMenu = (initialPath = "/") =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AdminMenu />
    </MemoryRouter>
  );

describe("AdminMenu", () => {
  test("renders heading", () => {
    renderMenu();
    expect(screen.getByRole("heading", { name: /admin panel/i })).toBeInTheDocument();
  });

  test("has Create Category link with correct href", () => {
    renderMenu();
    const link = screen.getByRole("link", { name: /create category/i });
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("/dashboard/admin/create-category")
    );
  });

  test("has Create Product link with correct href", () => {
    renderMenu();
    const link = screen.getByRole("link", { name: /create product/i });
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("/dashboard/admin/create-product")
    );
  });

  test("has Products link with correct href", () => {
    renderMenu();
    const link = screen.getByRole("link", { name: /products/i });
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("/dashboard/admin/products")
    );
  });

  test("has Orders link with correct href", () => {
    renderMenu();
    const link = screen.getByRole("link", { name: /orders/i });
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("/dashboard/admin/orders")
    );
  });

  test("does not render Users link (it's commented out)", () => {
    renderMenu();
    expect(screen.queryByRole("link", { name: /users/i })).not.toBeInTheDocument();
  });

  test("marks the active link with aria-current when on that route", () => {
    renderMenu("/dashboard/admin/products");
    const active = screen.getByRole("link", { name: /products/i });
    expect(active).toHaveAttribute("aria-current", "page");
  });

  test("links have list-group classes", () => {
    renderMenu();
    const link = screen.getByRole("link", { name: /create category/i });
    expect(link).toHaveClass("list-group-item", "list-group-item-action");
  });
});
