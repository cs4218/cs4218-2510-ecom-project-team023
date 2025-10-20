// Some tests written with help of AI
/**
 * FE↔BE “Sandwich” Integration Suite (single file)
 * - Bottom-Up: verify REST controllers via axios (no UI)
 * - Top-Down: render shell/guards with minimal local stubs
 * - Converge: full stack UI → real HTTP → real DB (no API mocks)
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";

// --- real server & test DB helpers ---
import app from "../../../../server.js";
import {
  connectToTestDb,
  disconnectFromTestDb,   // ← fix name
  resetTestDb,
} from "../../../../config/testdb.js";

// --- real models & helpers for seeding ---
import userModel from "../../../../models/userModel.js";
import categoryModel from "../../../../models/categoryModel.js";
import productModel from "../../../../models/productModel.js";
import orderModel from "../../../../models/orderModel.js";
import { hashPassword } from "../../../../helpers/authHelper.js";

// --- pages/components/providers used in UI tests ---
import Login from "../../pages/Auth/Login";
import AdminDashboard from "./AdminDashboard";
import AdminOrdersPage from "./AdminOrders";
import AdminUsersPage from "./Users";
import AdminRoute from "../../components/Routes/AdminRoute";
import PrivateRoute from "../../components/Routes/PrivateRoute";
import { AuthProvider } from "../../context/auth";

// minimal layout to keep the DOM quiet
jest.mock("../../components/Layout", () => ({ children }) => (
  <div data-testid="layout">{children}</div>
));

// spy toasts (no UI popups)
jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// constants & helpers
// ─────────────────────────────────────────────────────────────────────────────
const ADMIN_EMAIL = "admin@test.local";
const USER_EMAIL = "user@test.local";
const ADMIN_PWD = "Admin#123";
const USER_PWD = "User#123";

let server;
let seeded = {};
let seededIds = {};

const AppTree = ({ initialPath = "/login" }) => (
  <AuthProvider>
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* user area behind PrivateRoute */}
        <Route path="/dashboard" element={<PrivateRoute />}>
          <Route path="user/orders" element={<div>User Orders Page</div>} />
        </Route>

        {/* admin area behind AdminRoute */}
        <Route path="/dashboard" element={<AdminRoute />}>
          <Route path="admin" element={<AdminDashboard />}>
            {/* if AdminDashboard has <Outlet />, these render; tests won’t rely on them */}
            <Route path="orders" element={<AdminOrdersPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            {/* stubs so menu links resolve */}
            <Route path="create-category" element={<div data-testid="create-category-page">Create Category Page</div>} />
            <Route path="create-product" element={<div data-testid="create-product-page">Create Product Page</div>} />
            <Route path="products" element={<div data-testid="products-page">Products Page</div>} />
          </Route>
        </Route>

        <Route path="/" element={<div>Home Page</div>} />
        <Route path="/forgot-password" element={<div>Forgot Password Page</div>} />
      </Routes>
    </MemoryRouter>
  </AuthProvider>
);

const renderAppAt = (path = "/login") => render(<AppTree initialPath={path} />);

async function seedAll() {
  const [adminHashed, userHashed] = await Promise.all([
    hashPassword(ADMIN_PWD),
    hashPassword(USER_PWD),
  ]);

  const [admin, user] = await userModel.create([
    {
      name: "Admin Tester",
      email: ADMIN_EMAIL,
      password: adminHashed,
      phone: "00000000",
      address: "Nowhere",
      answer: "x",
      role: 1,
    },
    {
      name: "Normal Tester",
      email: USER_EMAIL,
      password: userHashed,
      phone: "11111111",
      address: "Somewhere",
      answer: "y",
      role: 0,
    },
  ]);

  const cat = await categoryModel.create({ name: "Electronics", slug: "electronics" });
  const prod = await productModel.create({
    name: "Widget",
    slug: "widget",
    description: "A test widget",
    price: 99,
    category: cat._id,
    quantity: 10,
    shipping: 1,
  });

  const [userOrder, adminOrder] = await orderModel.create([
    {
      products: [prod._id],
      payment: { id: "BRAIN-FAKE", status: "captured", amount: 99 },
      buyer: user._id,
      status: "Processing",
    },
    {
      products: [prod._id],
      payment: { id: "BRAIN-FAKE-2", status: "captured", amount: 99 },
      buyer: admin._id,
      status: "Processing",
    },
  ]);

  seeded = { admin, user, cat, prod, userOrder, adminOrder };
  seededIds = Object.fromEntries(
    Object.entries(seeded).map(([k, v]) => [k + "Id", String(v._id)])
  );
}

async function loginThroughUI(email, password) {
  renderAppAt("/login");
  fireEvent.change(screen.getByPlaceholderText(/enter your email/i), { target: { value: email } });
  fireEvent.change(screen.getByPlaceholderText(/enter your password/i), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: /login/i }));
}

async function loginAsAdminUI() {
  await loginThroughUI(ADMIN_EMAIL, ADMIN_PWD);
  await waitFor(() =>
    expect(toast.success).toHaveBeenCalledWith("login successfully", expect.any(Object))
  );
  const stored = JSON.parse(localStorage.getItem("auth"));
  expect(stored?.user?.email).toBe(ADMIN_EMAIL);
  expect(stored?.user?.role).toBe(1);
  expect(typeof stored?.token).toBe("string");
  // ensure axios carries the token for follow-up trees (guard may use axios defaults)
  axios.defaults.headers.common = axios.defaults.headers.common || {};
  axios.defaults.headers.common["Authorization"] = stored.token;
}

async function loginAsUserUI() {
  await loginThroughUI(USER_EMAIL, USER_PWD);
  await waitFor(() => expect(toast.success).toHaveBeenCalled());
  const stored = JSON.parse(localStorage.getItem("auth"));
  expect(stored?.user?.email).toBe(USER_EMAIL);
  expect(stored?.user?.role).toBe(0);
  axios.defaults.headers.common = axios.defaults.headers.common || {};
  axios.defaults.headers.common["Authorization"] = stored.token;
}

async function expectAxiosRejectStatus(promise, allowed = [401, 403]) {
  try {
    await promise;
    throw new Error("Expected request to reject");
  } catch (err) {
    expect(allowed).toContain(err?.response?.status);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// lifecycle: real DB, real HTTP on ephemeral port
// ─────────────────────────────────────────────────────────────────────────────
beforeAll(async () => {
  process.env.NODE_ENV = "test";
  await connectToTestDb("admin-fe-sandwich-int");
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
  localStorage.clear();
});

afterEach(async () => {
  await new Promise((r) => setTimeout(r, 20));
});

// ─────────────────────────────────────────────────────────────────────────────
// A. Bottom-Up: API contracts (axios)
// ─────────────────────────────────────────────────────────────────────────────
describe("Bottom-Up: API contracts (axios)", () => {
  test("admin-auth: admin token passes; user token rejected", async () => {
    const aTok = (await axios.post("/api/v1/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PWD })).data.token;
    const uTok = (await axios.post("/api/v1/auth/login", { email: USER_EMAIL, password: USER_PWD })).data.token;

    const ok = await axios.get("/api/v1/auth/admin-auth", { headers: { Authorization: aTok } });
    expect(ok.status).toBe(200);
    expect(ok.data?.ok).toBe(true);

    await expectAxiosRejectStatus(
      axios.get("/api/v1/auth/admin-auth", { headers: { Authorization: uTok } })
    );
  });

  test("users: admin can list users; non-admin forbidden", async () => {
    const aTok = (await axios.post("/api/v1/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PWD })).data.token;
    const uTok = (await axios.post("/api/v1/auth/login", { email: USER_EMAIL, password: USER_PWD })).data.token;

    const list = await axios.get("/api/v1/auth/users", { headers: { Authorization: aTok } });
    const emails = (list.data?.users ?? list.data ?? []).map((u) => u.email);
    expect(emails).toEqual(expect.arrayContaining([ADMIN_EMAIL, USER_EMAIL]));

    await expectAxiosRejectStatus(
      axios.get("/api/v1/auth/users", { headers: { Authorization: uTok } })
    );
  });

  test("orders: user sees only their orders; admin sees all", async () => {
    const aTok = (await axios.post("/api/v1/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PWD })).data.token;
    const uTok = (await axios.post("/api/v1/auth/login", { email: USER_EMAIL, password: USER_PWD })).data.token;

    const userOrders = await axios.get("/api/v1/auth/orders", { headers: { Authorization: uTok } });
    const uList = userOrders.data?.orders ?? userOrders.data ?? [];
    expect(Array.isArray(uList)).toBe(true);
    expect(uList).toHaveLength(1);

    const all = await axios.get("/api/v1/auth/all-orders", { headers: { Authorization: aTok } });
    const aList = all.data?.orders ?? all.data ?? [];
    expect(aList.length).toBe(2);
  });

  test("order-status: admin updates; non-admin forbidden", async () => {
    const aTok = (await axios.post("/api/v1/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PWD })).data.token;
    const uTok = (await axios.post("/api/v1/auth/login", { email: USER_EMAIL, password: USER_PWD })).data.token;

    const upd = await axios.put(
      `/api/v1/auth/order-status/${seededIds.userOrderId}`,
      { status: "Shipped" },
      { headers: { Authorization: aTok } }
    );
    expect([200, 201]).toContain(upd.status);

    await expectAxiosRejectStatus(
      axios.put(
        `/api/v1/auth/order-status/${seededIds.userOrderId}`,
        { status: "Delivered" },
        { headers: { Authorization: uTok } }
      )
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B. Top-Down: shell + guards with minimal local stubs
// ─────────────────────────────────────────────────────────────────────────────
describe("Top-Down: UI shell & guards (minimal local stubs)", () => {
  let getSpy;

  beforeEach(() => {
    // only stub the endpoints the guards/shell call
    getSpy = jest.spyOn(axios, "get").mockImplementation((url) => {
      if (url.includes("/api/v1/auth/admin-auth")) {
        return Promise.resolve({ status: 200, data: { ok: true } });
      }
      if (url.includes("/api/v1/auth/users")) {
        return Promise.resolve({
          status: 200,
          data: { users: [{ email: ADMIN_EMAIL }, { email: USER_EMAIL }] },
        });
      }
      if (url.includes("/api/v1/auth/all-orders")) {
        return Promise.resolve({
          status: 200,
          data: {
            orders: [
              { _id: "o1", buyer: { _id: seededIds.userId, email: USER_EMAIL }, products: [{ _id: seededIds.prodId }] },
              { _id: "o2", buyer: { _id: seededIds.adminId, email: ADMIN_EMAIL }, products: [{ _id: seededIds.prodId }] },
            ],
          },
        });
      }
      return Promise.reject(new Error(`Unexpected stubbed GET: ${url}`));
    });
  });

  afterEach(() => {
    getSpy?.mockRestore();
  });

  test("guard: unauthenticated user is redirected (spinner)", async () => {
    renderAppAt("/dashboard/admin");
    // Your guard shows a spinner + “redirecting… 3 second”; assert that
    expect(await screen.findByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/redirecting to you in/i)).toBeInTheDocument();
  });

  test("guard: non-admin blocked from /dashboard/admin", async () => {
    await loginAsUserUI();
    renderAppAt("/dashboard/admin");
    expect(await screen.findByText(/home page/i)).toBeInTheDocument();
  });

  test("admin can reach dashboard shell (stubbed guard ok)", async () => {
    await loginAsAdminUI();
    renderAppAt("/dashboard/admin");
    await waitFor(() => expect(screen.getByText(/admin panel/i)).toBeInTheDocument());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C. Converge: full stack UI → HTTP → DB (no API mocks)
// ─────────────────────────────────────────────────────────────────────────────
describe("Converge: full stack", () => {
  test("admin real login, can land on admin shell", async () => {
    await loginAsAdminUI();
    renderAppAt("/dashboard/admin");
    await waitFor(() => expect(screen.getByText(/admin panel/i)).toBeInTheDocument());
  });

  test("regular user real login, app safe at home", async () => {
    await loginAsUserUI();
    renderAppAt("/");
    expect(screen.getAllByText(/home page/i).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// D. Admin Menu coverage (no API mocks)
// ─────────────────────────────────────────────────────────────────────────────
describe("Admin Menu & Dashboard UI (no API mocks here)", () => {
  test("menu renders with all expected links and correct hrefs", async () => {
    await loginAsAdminUI();
    renderAppAt("/dashboard/admin");

    // wait for guard to finish and shell to appear
    await waitFor(() => expect(screen.getByText(/admin panel/i)).toBeInTheDocument());

    const linkCreateCategory = screen.getByRole("link", { name: /create category/i });
    const linkCreateProduct  = screen.getByRole("link", { name: /create product/i });
    const linkProducts       = screen.getByRole("link", { name: /products/i });
    const linkOrders         = screen.getByRole("link", { name: /orders/i });
    const linkUsers          = screen.getByRole("link", { name: /users/i });

    expect(linkCreateCategory).toHaveAttribute("href", "/dashboard/admin/create-category");
    expect(linkCreateProduct).toHaveAttribute("href", "/dashboard/admin/create-product");
    expect(linkProducts).toHaveAttribute("href", "/dashboard/admin/products");
    expect(linkOrders).toHaveAttribute("href", "/dashboard/admin/orders");
    expect(linkUsers).toHaveAttribute("href", "/dashboard/admin/users");
  });

  test("active state reflects location (aria-current='page')", async () => {
    await loginAsAdminUI();
    renderAppAt("/dashboard/admin/users");

    await waitFor(() => expect(screen.getByText(/admin panel/i)).toBeInTheDocument());

    const linkUsers  = screen.getByRole("link", { name: /users/i });
    const linkOrders = screen.getByRole("link", { name: /orders/i });

    expect(linkUsers).toHaveAttribute("aria-current", "page");
    expect(linkOrders).not.toHaveAttribute("aria-current", "page");
  });

  test("clicking menu links toggles active state (without relying on Outlet)", async () => {
    await loginAsAdminUI();
    renderAppAt("/dashboard/admin");

    await waitFor(() => expect(screen.getByText(/admin panel/i)).toBeInTheDocument());

    const linkCreateCategory = screen.getByRole("link", { name: /create category/i });
    fireEvent.click(linkCreateCategory);

    await waitFor(() => expect(linkCreateCategory).toHaveAttribute("aria-current", "page"));
  });
});
