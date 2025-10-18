/** @jest-environment jsdom */
import "@testing-library/jest-dom";

import React from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import {
  render,
  screen,
  within,
  waitFor,
  fireEvent,
} from "@testing-library/react";

import UpdateProduct from "./UpdateProduct";

// ---- Polyfill for JSDOM (file preview) ----
beforeAll(() => {
  global.URL.createObjectURL = jest.fn(() => "blob:mock");
  global.URL.revokeObjectURL = jest.fn();
});
afterAll(() => {
  delete global.URL.createObjectURL;
  delete global.URL.revokeObjectURL;
});

// ---- Mocks ----
jest.mock("axios", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));
import axios from "axios";

jest.mock("react-hot-toast", () => {
  const api = { success: jest.fn(), error: jest.fn() };
  return {
    __esModule: true,
    default: api,
    success: api.success,
    error: api.error,
  };
});
import toast from "react-hot-toast";

jest.mock("../../components/Layout", () => ({
  __esModule: true,
  default: ({ children }) => <div data-testid="layout">{children}</div>,
}));

jest.mock("../../components/AdminMenu", () => ({
  __esModule: true,
  default: () => <div data-testid="admin-menu">AdminMenu</div>,
}));

// Tame AntD Select → native <select> with accessible label
jest.mock("antd", () => {
  const React = require("react");
  const Select = ({ children, onChange, value, className, placeholder }) => (
    <select
      aria-label={placeholder || "select"}
      className={className}
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value)}
      data-testid="antd-select"
    >
      <option value="" />
      {React.Children.map(children, (c) =>
        React.cloneElement(c, { "data-from": "antd-option" })
      )}
    </select>
  );
  const Option = ({ value, children }) => <option value={value}>{children}</option>;
  return { __esModule: true, Select: Object.assign(Select, { Option }) };
});

// ---- Helpers ----
const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/dashboard/admin/product/update/widget-pro"]}>
      <Routes>
        <Route path="/dashboard/admin/product/update/:slug" element={<UpdateProduct />} />
        <Route
          path="/dashboard/admin/products"
          element={<div data-testid="products-page">Products</div>}
        />
      </Routes>
    </MemoryRouter>
  );

const change = (el, value) => fireEvent.change(el, { target: { value } });
const typeText = (el, value) => change(el, value);
const setFile = (input, file) =>
  fireEvent.change(input, { target: { files: [file] } });

// Shared payload for GET /get-product/:slug
const productPayload = {
  data: {
    product: {
      _id: "p1",
      name: "Widget Pro",
      slug: "widget-pro",
      description: "Fast",
      price: 999,
      quantity: 5,
      shipping: 1,
      category: { _id: "c2", name: "Electronics" },
    },
  },
};

describe("UpdateProduct ↔ ProductController (mocked HTTP, real layout/menu)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("prefills form from GET product + categories", async () => {
    axios.get
      .mockResolvedValueOnce(productPayload) // product
      .mockResolvedValueOnce({
        data: {
          success: true,
          category: [
            { _id: "c1", name: "Books" },
            { _id: "c2", name: "Electronics" },
          ],
        },
      }); // categories

    renderPage();

    // Wait for prefilled values
    await waitFor(() => {
      expect(screen.getByDisplayValue("Widget Pro")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Fast")).toBeInTheDocument();
      expect(screen.getByDisplayValue("999")).toBeInTheDocument();
      expect(screen.getByDisplayValue("5")).toBeInTheDocument();
      expect(screen.getByLabelText(/select shipping/i).value).toBe("1");
      expect(screen.getByLabelText(/select a category/i).value).toBe("c2");
    });

    const categorySelect = screen.getByLabelText(/select a category/i);
    await within(categorySelect).findByRole("option", { name: "Books" });
    const opts = within(categorySelect).getAllByRole("option");
    expect(opts.map((o) => o.textContent)).toEqual(["", "Books", "Electronics"]);
  });

  it("updates product via PUT and shows success toast", async () => {
    axios.get
      .mockResolvedValueOnce(productPayload) // product
      .mockResolvedValueOnce({
        data: {
          success: true,
          category: [
            { _id: "c1", name: "Books" },
            { _id: "c2", name: "Electronics" },
          ],
        },
      }); // categories
    axios.put.mockResolvedValueOnce({ data: { success: true } });

    renderPage();

    // Ensure id & fields are loaded
    await screen.findByDisplayValue("Widget Pro");

    typeText(screen.getByDisplayValue("Widget Pro"), " Widget X");
    change(screen.getByLabelText(/select shipping/i), "0");
    change(screen.getByLabelText(/select a category/i), "c1");

    const file = new File(["bytes"], "new.jpg", { type: "image/jpeg" });
    const fileInput = screen.getByLabelText(/upload photo/i);
    setFile(fileInput, file);

    fireEvent.click(screen.getByRole("button", { name: /update product/i }));

    await waitFor(() => {
      expect(axios.put).toHaveBeenCalled();
      const [url, body] = axios.put.mock.calls[0];
      expect(url).toBe("/api/v1/product/update-product/p1");
      expect(body instanceof FormData).toBe(true);
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Product Updated Successfully");
      expect(screen.getByTestId("products-page")).toBeInTheDocument();
    });
  });

  it("delete product asks confirm, deletes, shows toast and navigates", async () => {
    axios.get
      .mockResolvedValueOnce(productPayload) // product
      .mockResolvedValueOnce({
        data: { success: true, category: [{ _id: "c2", name: "Electronics" }] },
      }); // categories
    axios.delete.mockResolvedValueOnce({ data: { success: true } });

    const spy = jest.spyOn(window, "prompt").mockReturnValue("yes");
    renderPage();

    await screen.findByDisplayValue("Widget Pro");
    fireEvent.click(screen.getByRole("button", { name: /delete product/i }));

    await waitFor(() => {
      expect(spy).toHaveBeenCalled();
      expect(axios.delete).toHaveBeenCalledWith("/api/v1/product/delete-product/p1");
      expect(toast.success).toHaveBeenCalledWith("Product Deleted Successfully");
      expect(screen.getByTestId("products-page")).toBeInTheDocument();
    });

    spy.mockRestore();
  });
});
