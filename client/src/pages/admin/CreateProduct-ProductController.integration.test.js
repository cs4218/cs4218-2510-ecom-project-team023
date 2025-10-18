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

import CreateProduct from "./CreateProduct";

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
    <MemoryRouter initialEntries={["/dashboard/admin/create-product"]}>
      <Routes>
        <Route path="/dashboard/admin/create-product" element={<CreateProduct />} />
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

describe("CreateProduct ↔ ProductController (mocked HTTP, real layout/menu)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads categories into the Category Select", async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        success: true,
        category: [
          { _id: "c1", name: "Books" },
          { _id: "c2", name: "Electronics" },
        ],
      },
    });

    renderPage();

    // Wait for category select to be populated
    const categorySelect = await screen.findByLabelText(/select a category/i);
    await within(categorySelect).findByRole("option", { name: "Books" });
    const options = within(categorySelect).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["", "Books", "Electronics"]);

    const shippingSelect = screen.getByLabelText(/select shipping/i);
    const shipOptions = within(shippingSelect).getAllByRole("option");
    expect(shipOptions.map((o) => o.textContent)).toEqual(["", "No", "Yes"]);
  });

  it("successful create posts FormData and shows success toast", async () => {
    // categories
    axios.get.mockResolvedValueOnce({
      data: { success: true, category: [{ _id: "c1", name: "Books" }] },
    });
    // create
    axios.post.mockResolvedValueOnce({ data: { success: true } });

    renderPage();

    change(await screen.findByLabelText(/select a category/i), "c1");

    // file
    const file = new File(["bytes"], "pic.png", { type: "image/png" });
    const fileInput = screen.getByLabelText(/upload photo/i);
    setFile(fileInput, file);

    // text inputs
    typeText(screen.getByPlaceholderText(/write a name/i), "The Hobbit");
    typeText(screen.getByPlaceholderText(/write a description/i), "Classic");
    typeText(screen.getByPlaceholderText(/write a price/i), "19");
    typeText(screen.getByPlaceholderText(/write a quantity/i), "3");
    change(screen.getByLabelText(/select shipping/i), "1");

    fireEvent.click(screen.getByRole("button", { name: /create product/i }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalled();
      const [url, body] = axios.post.mock.calls[0];
      expect(url).toBe("/api/v1/product/create-product");
      expect(body instanceof FormData).toBe(true);
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Product Created Successfully");
      expect(screen.getByTestId("products-page")).toBeInTheDocument();
    });
  });

  it("server failure → shows error toast and stays on page", async () => {
    axios.get.mockResolvedValueOnce({
      data: { success: true, category: [{ _id: "c1", name: "Books" }] },
    });
    axios.post.mockResolvedValueOnce({
      data: { success: false, message: "Nope" },
    });

    renderPage();

    change(await screen.findByLabelText(/select a category/i), "c1");
    typeText(screen.getByPlaceholderText(/write a name/i), "X");
    typeText(screen.getByPlaceholderText(/write a description/i), "Y");
    typeText(screen.getByPlaceholderText(/write a price/i), "1");
    typeText(screen.getByPlaceholderText(/write a quantity/i), "1");
    change(screen.getByLabelText(/select shipping/i), "0");

    fireEvent.click(screen.getByRole("button", { name: /create product/i }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith("Nope");
      expect(screen.queryByTestId("products-page")).toBeNull();
      expect(screen.getByRole("heading", { name: /create product/i })).toBeInTheDocument();
    });
  });
});
