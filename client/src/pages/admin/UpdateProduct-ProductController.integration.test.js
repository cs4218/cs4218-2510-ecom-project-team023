import "@testing-library/jest-dom";

import React from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { render, screen, within, waitFor, fireEvent } from "@testing-library/react";
import axios from "axios";
import toast from "react-hot-toast";

// Polyfills for file preview in JSDOM
beforeAll(() => {
  global.URL.createObjectURL = jest.fn(() => "blob:mock");
  global.URL.revokeObjectURL = jest.fn();
});
afterAll(() => {
  delete global.URL.createObjectURL;
  delete global.URL.revokeObjectURL;
});

// Keep layout noise minimal; keep AdminMenu present but tiny
jest.mock("../../components/Layout", () => ({
  __esModule: true,
  default: ({ children }) => <div data-testid="layout">{children}</div>,
}));
jest.mock("../../components/AdminMenu", () => ({
  __esModule: true,
  default: () => <div data-testid="admin-menu">AdminMenu</div>,
}));

// Tame AntD Select → accessible native <select>
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
      {React.Children.map(children, (c) => React.cloneElement(c, { "data-from": "antd-option" }))}
    </select>
  );
  const Option = ({ value, children }) => <option value={value}>{children}</option>;
  return { __esModule: true, Select: Object.assign(Select, { Option }) };
});

// Toast spy
jest.mock("react-hot-toast", () => {
  const api = { success: jest.fn(), error: jest.fn() };
  return { __esModule: true, default: api, success: api.success, error: api.error };
});

import UpdateProduct from "./UpdateProduct";

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────
const renderAt = (path = "/dashboard/admin/product/update/widget-pro") =>
  render(
    <MemoryRouter initialEntries={[path]}>
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
const setFile = (input, file) => fireEvent.change(input, { target: { files: [file] } });

// Product GET payload used across Top-Down tests
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

// ─────────────────────────────────────────────────────────────────────────────
// A) Top-Down: minimal local HTTP stubs (no real server)
// ─────────────────────────────────────────────────────────────────────────────
describe("Top-Down: UpdateProduct UI (local HTTP stubs only)", () => {
  let getSpy, putSpy, delSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    getSpy = jest.spyOn(axios, "get");
    putSpy = jest.spyOn(axios, "put");
    delSpy = jest.spyOn(axios, "delete");
  });

  afterEach(() => {
    getSpy?.mockRestore();
    putSpy?.mockRestore();
    delSpy?.mockRestore();
  });

  test("prefills form from GET product + categories", async () => {
    getSpy
      .mockResolvedValueOnce(productPayload) // GET /get-product/:slug
      .mockResolvedValueOnce({
        data: { success: true, category: [{ _id: "c1", name: "Books" }, { _id: "c2", name: "Electronics" }] },
      }); // GET /category/get-category

    renderAt();

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
    const opts = within(categorySelect).getAllByRole("option").map((o) => o.textContent);
    expect(opts).toEqual(["", "Books", "Electronics"]);
  });

  test("updates product via PUT and shows success toast", async () => {
    getSpy
      .mockResolvedValueOnce(productPayload)
      .mockResolvedValueOnce({
        data: { success: true, category: [{ _id: "c1", name: "Books" }, { _id: "c2", name: "Electronics" }] },
      });
    putSpy.mockResolvedValueOnce({ data: { success: true } });

    renderAt();

    await screen.findByDisplayValue("Widget Pro");
    typeText(screen.getByDisplayValue("Widget Pro"), " X");
    change(screen.getByLabelText(/select shipping/i), "0");
    change(screen.getByLabelText(/select a category/i), "c1");

    const file = new File(["bytes"], "new.jpg", { type: "image/jpeg" });
    setFile(screen.getByLabelText(/upload photo/i), file);

    fireEvent.click(screen.getByRole("button", { name: /update product/i }));

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalled();
      const [url, body] = putSpy.mock.calls[0];
      expect(url).toBe("/api/v1/product/update-product/p1");
      expect(body instanceof FormData).toBe(true);
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled(); // message text may vary across apps
      expect(screen.getByTestId("products-page")).toBeInTheDocument();
    });
  });

  test("delete product asks confirm, deletes, shows toast and navigates", async () => {
    getSpy
      .mockResolvedValueOnce(productPayload)
      .mockResolvedValueOnce({ data: { success: true, category: [{ _id: "c2", name: "Electronics" }] } });
    delSpy.mockResolvedValueOnce({ data: { success: true } });

    const spy = jest.spyOn(window, "prompt").mockReturnValue("yes");

    renderAt();
    await screen.findByDisplayValue("Widget Pro");

    fireEvent.click(screen.getByRole("button", { name: /delete product/i }));

    await waitFor(() => {
      expect(spy).toHaveBeenCalled();
      expect(delSpy).toHaveBeenCalledWith("/api/v1/product/delete-product/p1");
      expect(toast.success).toHaveBeenCalled(); // don’t rely on exact message
      expect(screen.getByTestId("products-page")).toBeInTheDocument();
    });

    spy.mockRestore();
  });

  test("server failure on update → shows error toast and stays on page", async () => {
    getSpy
      .mockResolvedValueOnce(productPayload)
      .mockResolvedValueOnce({
        data: { success: true, category: [{ _id: "c1", name: "Books" }, { _id: "c2", name: "Electronics" }] },
      });
    putSpy.mockResolvedValueOnce({ data: { success: false, message: "Nope" } });

    renderAt();

    await screen.findByDisplayValue("Widget Pro");
    fireEvent.click(screen.getByRole("button", { name: /update product/i }));

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith("Nope");
      expect(screen.getByRole("heading", { name: /update product/i })).toBeInTheDocument();
      expect(screen.queryByTestId("products-page")).toBeNull();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B) Converge: real HTTP + real DB (no API mocks)
// ─────────────────────────────────────────────────────────────────────────────
import app from "../../../../server.js";
import { connectToTestDb, resetTestDb, disconnectFromTestDb } from "../../../../config/testdb.js";
import userModel from "../../../../models/userModel.js";
import categoryModel from "../../../../models/categoryModel.js";
import productModel from "../../../../models/productModel.js";
import { hashPassword } from "../../../../helpers/authHelper.js";

describe("Converge: UpdateProduct end-to-end (no API mocks)", () => {
  let server;
  const ADMIN_EMAIL = "admin@test.local";
  const ADMIN_PWD = "Admin#123";
  let created = {};

  async function seedAll() {
    const pwd = await hashPassword(ADMIN_PWD);
    const admin = await userModel.create({
      name: "Admin",
      email: ADMIN_EMAIL,
      password: pwd,
      phone: "00000000",
      address: "x",
      answer: "x",
      role: 1,
    });

    const [books, electronics] = await categoryModel.create([
      { name: "Books", slug: "books" },
      { name: "Electronics", slug: "electronics" },
    ]);

    const prod = await productModel.create({
      name: "Widget Pro",
      slug: "widget-pro",
      description: "Fast",
      price: 999,
      quantity: 5,
      shipping: 1,
      category: electronics._id,
      photo: undefined,
    });

    created = { admin, books, electronics, prod };
  }

  async function loginAndPrimeAuth() {
    const res = await axios.post("/api/v1/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PWD });
    const { token, user } = res.data;
    // Your app reads from localStorage in its AuthContext/useAuth:
    localStorage.setItem("auth", JSON.stringify({ user, token }));
    // CRUCIAL for server-protected routes in tests: also set axios default header
    axios.defaults.headers.common = axios.defaults.headers.common || {};
    axios.defaults.headers.common.Authorization = token;
  }

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    await connectToTestDb("update-product-fe-int");
    server = app.listen(0);
    const port = server.address().port;
    axios.defaults.baseURL = `http://localhost:${port}`;
  });

  afterAll(async () => {
    await new Promise((r) => server.close(r));
    await disconnectFromTestDb();
  });

  beforeEach(async () => {
    await resetTestDb();
    await seedAll();
    jest.clearAllMocks();
  });

  test("initial product/categories prefill → update succeeds (multipart) → navigate", async () => {
    await loginAndPrimeAuth();
    renderAt("/dashboard/admin/product/update/widget-pro");

    // Prefill via real HTTP
    await waitFor(() => {
      expect(screen.getByDisplayValue("Widget Pro")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Fast")).toBeInTheDocument();
    });

    const catSelect = await screen.findByLabelText(/select a category/i);
    await waitFor(() => {
      const optsNow = within(catSelect).getAllByRole("option");
      expect(optsNow.length).toBeGreaterThan(1);
    });

    const nameInput = screen.getByPlaceholderText(/write a name/i);
    fireEvent.change(nameInput, { target: { value: "Widget Pro X" } });
    change(screen.getByLabelText(/select shipping/i), "0");

    // choose "Books" by id
    const books = await categoryModel.findOne({ name: "Books" });
    fireEvent.change(catSelect, { target: { value: books._id.toString() } });

    const file = new File(["bytes"], "new.jpg", { type: "image/jpeg" });
    setFile(screen.getByLabelText(/upload photo/i), file);

    fireEvent.click(screen.getByRole("button", { name: /update product/i }));

    await waitFor(() => {
      // success toast might be custom; don’t pin to exact string
      expect(toast.success).toHaveBeenCalled();
      expect(screen.getByTestId("products-page")).toBeInTheDocument();
    });

    // DB sanity
    const updated = await productModel.findById(created.prod._id).populate("category");
    expect(updated.name).toMatch(/Widget Pro X$/);
    expect(String(updated.category._id)).toBe(String(books._id));
    expect(updated.shipping).toBe(false);
  });

  test("delete flow (real HTTP) → confirm → DB row gone → navigates", async () => {
    await loginAndPrimeAuth();
    const spy = jest.spyOn(window, "prompt").mockReturnValue("yes");

    renderAt("/dashboard/admin/product/update/widget-pro");
    await screen.findByDisplayValue("Widget Pro");

    fireEvent.click(screen.getByRole("button", { name: /delete product/i }));

    await waitFor(async () => {
      expect(screen.getByTestId("products-page")).toBeInTheDocument();
      const gone = await productModel.findById(created.prod._id);
      expect(gone).toBeNull();
    });

    spy.mockRestore();
  });
});
