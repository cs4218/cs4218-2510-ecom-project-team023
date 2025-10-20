import "@testing-library/jest-dom";
import React from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { render, screen, within, waitFor, fireEvent } from "@testing-library/react";
import axios from "axios";
import toast from "react-hot-toast";

// ─── REAL server & DB helpers ────────────────────────────────────────────────
import app from "../../../../server.js";
import {
  connectToTestDb,
  disconnectFromTestDb,
  resetTestDb,
} from "../../../../config/testdb.js";

// ─── REAL models/helpers (for seeding) ───────────────────────────────────────
import userModel from "../../../../models/userModel.js";
import categoryModel from "../../../../models/categoryModel.js";
import { hashPassword } from "../../../../helpers/authHelper.js";

// ─── PAGES / ROUTES / CONTEXT  ─────────────────────────────────
import CreateProduct from "./CreateProduct";
import Login from "../../pages/Auth/Login";
import AdminRoute from "../../components/Routes/AdminRoute";
import { AuthProvider } from "../../context/auth";

// ─── Polyfill (file preview) ────────────────────────────────────────────────
beforeAll(() => {
  global.URL.createObjectURL = jest.fn(() => "blob:mock");
  global.URL.revokeObjectURL = jest.fn();
});
afterAll(() => {
  delete global.URL.createObjectURL;
  delete global.URL.revokeObjectURL;
});

// ─── Tame layout noise & menu ────────────────────────────────────────────────
jest.mock("../../components/Layout", () => ({
  __esModule: true,
  default: ({ children }) => <div data-testid="layout">{children}</div>,
}));
jest.mock("../../components/AdminMenu", () => ({
  __esModule: true,
  default: () => <div data-testid="admin-menu">AdminMenu</div>,
}));

// ─── Toast spies ────────────────────────────────────────────────────────────
jest.mock("react-hot-toast", () => {
  const api = { success: jest.fn(), error: jest.fn() };
  return { __esModule: true, default: api, success: api.success, error: api.error };
});

// ─── AntD Select shim for accessibility in tests ────────────────────────────
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

// ─── Tiny helpers ────────────────────────────────────────────────────────────
const ADMIN_EMAIL = "admin@test.local";
const ADMIN_PWD = "Admin#123";
let server;

const AppTree = ({ initialPath = "/dashboard/admin/create-product" }) => (
  <AuthProvider>
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<AdminRoute />}>
          <Route path="admin/create-product" element={<CreateProduct />} />
          <Route path="admin/products" element={<div data-testid="products-page">Products</div>} />
        </Route>
        <Route path="/" element={<div>Home Page</div>} />
      </Routes>
    </MemoryRouter>
  </AuthProvider>
);

const renderAt = (path) => render(<AppTree initialPath={path} />);
const change = (el, value) => fireEvent.change(el, { target: { value } });
const typeText = (el, value) => change(el, value);
const setFile = (input, file) => fireEvent.change(input, { target: { files: [file] } });

// Seed one admin + a couple of categories
async function seedAdminAndCats() {
  const hashed = await hashPassword(ADMIN_PWD);
  await userModel.create({
    name: "Admin Tester",
    email: ADMIN_EMAIL,
    password: hashed,
    phone: "00000000",
    address: "Nowhere",
    answer: "x",
    role: 1,
  });
  await categoryModel.create([
    { name: "Books", slug: "books" },
    { name: "Electronics", slug: "electronics" },
  ]);
}

// Backend login; preload localStorage/headers for UI path
async function authenticateAsAdmin() {
  const res = await axios.post("/api/v1/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PWD });
  const { token, user } = res.data;
  localStorage.setItem("auth", JSON.stringify({ token, user }));
  axios.defaults.headers.common = axios.defaults.headers.common || {};
  axios.defaults.headers.common["Authorization"] = token;
}

// ─── Lifecycle: real DB + real HTTP (ephemeral port) ─────────────────────────
beforeAll(async () => {
  process.env.NODE_ENV = "test";
  await connectToTestDb("create-product-sandwich-int");
  server = app.listen(0);
  axios.defaults.baseURL = `http://localhost:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((r) => server.close(r));
  await disconnectFromTestDb();
});

beforeEach(async () => {
  await resetTestDb();
  localStorage.clear();
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// A) Bottom-Up: raw API contract via axios (no UI)
// ─────────────────────────────────────────────────────────────────────────────
describe("Bottom-Up: /api/v1/product (axios only)", () => {
  test("categories list → create product (multipart)", async () => {
    await seedAdminAndCats();
    await authenticateAsAdmin();

    const list = await axios.get("/api/v1/category/get-category");
    const catNames = (list.data?.category ?? []).map((c) => c.name);
    expect(catNames).toEqual(expect.arrayContaining(["Books", "Electronics"]));

    const fd = new FormData();
    fd.append("name", "The Hobbit");
    fd.append("description", "Classic");
    fd.append("price", "19");
    fd.append("category", (list.data?.category ?? [])[0]._id);
    fd.append("quantity", "3");
    fd.append("shipping", "1");
    fd.append("photo", new Blob(["a"], { type: "image/png" }), "hobbit.png");

    const created = await axios.post("/api/v1/product/create-product", fd);
    expect(created.data?.success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B) Top-Down: CreateProduct UI with *minimal local stubs*
// ─────────────────────────────────────────────────────────────────────────────
describe("Top-Down: CreateProduct UI (local HTTP stubs only)", () => {
  let getSpy, postSpy;

  beforeEach(() => {
    // Pretend already authed admin so AdminRoute allows access
    localStorage.setItem(
      "auth",
      JSON.stringify({ user: { email: ADMIN_EMAIL, role: 1 }, token: "stub-token" })
    );
    axios.defaults.headers.common = axios.defaults.headers.common || {};
    axios.defaults.headers.common["Authorization"] = "stub-token";

    // Default GET stub includes guard *and* category list
    getSpy = jest.spyOn(axios, "get").mockImplementation((url) => {
      if (url.includes("/api/v1/auth/admin-auth")) {
        return Promise.resolve({ status: 200, data: { ok: true } });
      }
      if (url.includes("/api/v1/category/get-category")) {
        return Promise.resolve({
          data: {
            success: true,
            category: [
              { _id: "c1", name: "Books" },
              { _id: "c2", name: "Electronics" },
            ],
          },
        });
      }
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });

    postSpy = jest.spyOn(axios, "post").mockImplementation((url, body) => {
      if (url.includes("/api/v1/product/create-product")) {
        return Promise.resolve({ data: { success: true } });
      }
      return Promise.reject(new Error(`Unexpected POST ${url}`));
    });
  });

  afterEach(() => {
    getSpy?.mockRestore();
    postSpy?.mockRestore();
  });

  test("loads categories and successful create posts FormData → toast + navigate", async () => {
    renderAt("/dashboard/admin/create-product");

    const categorySelect = await screen.findByLabelText(/select a category/i);
    await within(categorySelect).findByRole("option", { name: "Books" });

    fireEvent.change(categorySelect, { target: { value: "c1" } });
    setFile(screen.getByLabelText(/upload photo/i), new File(["bytes"], "pic.png", { type: "image/png" }));
    typeText(screen.getByPlaceholderText(/write a name/i), "The Hobbit");
    typeText(screen.getByPlaceholderText(/write a description/i), "Classic");
    typeText(screen.getByPlaceholderText(/write a price/i), "19");
    typeText(screen.getByPlaceholderText(/write a quantity/i), "3");
    fireEvent.change(screen.getByLabelText(/select shipping/i), { target: { value: "1" } });

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

  test("server failure → shows error toast and stays on page", async () => {
    // Keep the guard response intact; only override the *category* GET once
    getSpy.mockImplementationOnce((url) => {
      if (url.includes("/api/v1/auth/admin-auth")) {
        return Promise.resolve({ status: 200, data: { ok: true } });
      }
      if (url.includes("/api/v1/category/get-category")) {
        return Promise.resolve({
          data: { success: true, category: [{ _id: "c1", name: "Books" }] },
        });
      }
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });

    // Force create to fail
    postSpy.mockResolvedValueOnce({ data: { success: false, message: "Nope" } });

    renderAt("/dashboard/admin/create-product");

    const cat = await screen.findByLabelText(/select a category/i);
    fireEvent.change(cat, { target: { value: "c1" } });
    typeText(screen.getByPlaceholderText(/write a name/i), "X");
    typeText(screen.getByPlaceholderText(/write a description/i), "Y");
    typeText(screen.getByPlaceholderText(/write a price/i), "1");
    typeText(screen.getByPlaceholderText(/write a quantity/i), "1");
    fireEvent.change(screen.getByLabelText(/select shipping/i), { target: { value: "0" } });

    fireEvent.click(screen.getByRole("button", { name: /create product/i }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith("Nope");
      expect(screen.queryByTestId("products-page")).toBeNull();
      expect(screen.getByRole("heading", { name: /create product/i })).toBeInTheDocument();
    });
  });

  test("unauthenticated: guard shows spinner redirect (no login form here)", async () => {
    localStorage.clear();
    renderAt("/dashboard/admin/create-product");
    expect(await screen.findByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/redirecting to you in/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C) Converge: UI → real HTTP → real DB (no API mocks)
// ─────────────────────────────────────────────────────────────────────────────
describe("Converge: CreateProduct end-to-end (no API mocks)", () => {
  test("initial categories load → create product succeeds (multipart) → navigate", async () => {
    await seedAdminAndCats();
    await authenticateAsAdmin();

    renderAt("/dashboard/admin/create-product");

    // Categories from real DB; just assert we have > 1 option
    const catSelect = await screen.findByLabelText(/select a category/i);
    // Wait until the categories actually render (real HTTP + state update)
    await waitFor(() => {
      const optsNow = within(catSelect).getAllByRole("option");
      expect(optsNow.length).toBeGreaterThan(1);
    });
    // Choose Books by value (id) from DB to avoid relying on display text
    const books = await categoryModel.findOne({ name: "Books" });
    fireEvent.change(catSelect, { target: { value: books._id.toString() } });

    setFile(screen.getByLabelText(/upload photo/i), new File(["bytes"], "pic.png", { type: "image/png" }));
    typeText(screen.getByPlaceholderText(/write a name/i), "The Hobbit");
    typeText(screen.getByPlaceholderText(/write a description/i), "Classic");
    typeText(screen.getByPlaceholderText(/write a price/i), "19");
    typeText(screen.getByPlaceholderText(/write a quantity/i), "3");
    fireEvent.change(screen.getByLabelText(/select shipping/i), { target: { value: "1" } });

    fireEvent.click(screen.getByRole("button", { name: /create product/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Product Created Successfully");
      expect(screen.getByTestId("products-page")).toBeInTheDocument();
    });
  });
});
