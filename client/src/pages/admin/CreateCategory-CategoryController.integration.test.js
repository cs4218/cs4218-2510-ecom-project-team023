// Some tests written with help of AI
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

// ─── PAGES / ROUTES / CONTEXT ─────────────────────────────────
import Login from "../../pages/Auth/Login";
import AdminRoute from "../../components/Routes/AdminRoute";
import { AuthProvider } from "../../context/auth";
import CreateCategory from "./CreateCategory";

// Keep layout noise down
jest.mock("../../components/Layout", () => ({
  __esModule: true,
  default: ({ children }) => <div data-testid="layout">{children}</div>,
}));

// AdminMenu is decorative for this test; keep it tiny
jest.mock("../../components/AdminMenu", () => ({
  __esModule: true,
  default: () => <div data-testid="admin-menu">AdminMenu</div>,
}));

// Toast spies
jest.mock("react-hot-toast", () => {
  const api = { success: jest.fn(), error: jest.fn() };
  return { __esModule: true, default: api, success: api.success, error: api.error };
});

// Mock only antd.Modal to be deterministic in jsdom
jest.mock("antd", () => {
  const actual = jest.requireActual("antd");
  const Modal = ({ visible, open, onCancel, children }) => {
    const isOpen = (open ?? visible) ? true : false;
    return (
      <div data-testid="modal" data-open={isOpen ? "true" : "false"}>
        {isOpen ? (
          <>
            <button aria-label="close-modal" type="button" onClick={onCancel} />
            {children}
          </>
        ) : null}
      </div>
    );
  };
  return { ...actual, Modal };
});

// ─── Tiny helpers ────────────────────────────────────────────────────────────
const ADMIN_EMAIL = "admin@test.local";
const ADMIN_PWD = "Admin#123";

let server;

// Table helpers (used in Top-Down & Converge)
const table = () => screen.getByRole("table");
const listRows = () => within(table()).getAllByRole("row");
const getRowByName = (name) => within(table()).getByText(name).closest("tr");

const AppTree = ({ initialPath = "/dashboard/admin/create-category" }) => (
  <AuthProvider>
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        {/* Admin area behind AdminRoute just like the app */}
        <Route path="/dashboard" element={<AdminRoute />}>
          <Route path="admin/create-category" element={<CreateCategory />} />
        </Route>
        <Route path="/" element={<div>Home Page</div>} />
      </Routes>
    </MemoryRouter>
  </AuthProvider>
);

const renderAt = (path) => render(<AppTree initialPath={path} />);

async function seedUsersAndInitialCategories() {
  // seed admin
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

  // seed a couple categories
  await categoryModel.create([
    { name: "Books", slug: "books" },
    { name: "Electronics", slug: "electronics" },
  ]);
}

// Login via backend & preload auth into localStorage so AuthProvider picks it up
async function authenticateAsAdmin() {
  const res = await axios.post("/api/v1/auth/login", {
    email: ADMIN_EMAIL,
    password: ADMIN_PWD,
  });
  const { token, user } = res.data;
  localStorage.setItem("auth", JSON.stringify({ token, user }));
  axios.defaults.headers.common = axios.defaults.headers.common || {};
  axios.defaults.headers.common["Authorization"] = token;
}

async function waitForCategoriesLoaded(...names) {
  for (const n of names) {
    // eslint-disable-next-line no-await-in-loop
    await screen.findByText(n);
  }
}

// ─── Lifecycle: real DB + real HTTP (ephemeral port) ─────────────────────────
beforeAll(async () => {
  process.env.NODE_ENV = "test";
  await connectToTestDb("create-category-sandwich-int");
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
describe("Bottom-Up: /api/v1/category (axios only)", () => {
  test("list → create → update → delete", async () => {
    await seedUsersAndInitialCategories();
    await authenticateAsAdmin();

    // list
    const list1 = await axios.get("/api/v1/category/get-category");
    const names1 = (list1.data?.category ?? []).map((c) => c.name);
    expect(names1).toEqual(expect.arrayContaining(["Books", "Electronics"]));

    // create
    const create = await axios.post("/api/v1/category/create-category", { name: "Toys" });
    expect(create.data?.success).toBe(true);

    const list2 = await axios.get("/api/v1/category/get-category");
    const names2 = (list2.data?.category ?? []).map((c) => c.name);
    expect(names2).toEqual(expect.arrayContaining(["Books", "Electronics", "Toys"]));

    // update: need id of Toys
    const toys = (list2.data?.category ?? []).find((c) => c.name === "Toys");
    const upd = await axios.put(`/api/v1/category/update-category/${toys._id}`, { name: "Kids Toys" });
    expect(upd.data?.success).toBe(true);

    const list3 = await axios.get("/api/v1/category/get-category");
    const names3 = (list3.data?.category ?? []).map((c) => c.name);
    expect(names3).toEqual(expect.arrayContaining(["Books", "Electronics", "Kids Toys"]));

    // delete
    const del = await axios.delete(`/api/v1/category/delete-category/${toys._id}`);
    expect(del.data?.success).toBe(true);

    const list4 = await axios.get("/api/v1/category/get-category");
    const names4 = (list4.data?.category ?? []).map((c) => c.name);
    expect(names4).toEqual(expect.arrayContaining(["Books", "Electronics"]));
    expect(names4).not.toContain("Kids Toys");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B) Top-Down: render shell with *local stubs* for child fetches
//     – Here we stub only the category endpoints & admin-auth guard.
//     – We SEQUENCE the category GET responses to avoid race conditions.
// ─────────────────────────────────────────────────────────────────────────────
describe("Top-Down: CreateCategory UI with minimal local stubs", () => {
  let getSpy, postSpy, putSpy, deleteSpy;

  beforeEach(async () => {
    // pre-auth in localStorage so AdminRoute doesn't redirect
    localStorage.setItem(
      "auth",
      JSON.stringify({ user: { email: ADMIN_EMAIL, role: 1 }, token: "stub-token" })
    );
    axios.defaults.headers.common = axios.defaults.headers.common || {};
    axios.defaults.headers.common["Authorization"] = "stub-token";

    // Prepare deterministic sequence for category GETs:
    const initial = {
      success: true,
      category: [
        { _id: "a", name: "Books" },
        { _id: "b", name: "Electronics" },
      ],
    };
    const afterCreate = {
      success: true,
      category: [
        ...initial.category,
        { _id: "c", name: "Toys" },
      ],
    };
    const afterUpdate = {
      success: true,
      category: [
        { _id: "a", name: "Books" },
        { _id: "b", name: "Electronics" },
        { _id: "c", name: "Kids Toys" },
      ],
    };
    const afterDelete = initial;

    let catIdx = 0;
    const catResponses = [initial, afterCreate, afterUpdate, afterDelete];

    getSpy = jest.spyOn(axios, "get").mockImplementation((url) => {
      if (url.includes("/api/v1/auth/admin-auth")) {
        // guard should always succeed
        return Promise.resolve({ status: 200, data: { ok: true } });
      }
      if (url.includes("/api/v1/category/get-category")) {
        const payload = catResponses[Math.min(catIdx, catResponses.length - 1)];
        catIdx += 1;
        return Promise.resolve({ data: payload });
      }
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });

    postSpy = jest.spyOn(axios, "post").mockImplementation((url, body) => {
      if (url.includes("/api/v1/category/create-category")) {
        return Promise.resolve({ data: { success: true } });
      }
      return Promise.reject(new Error(`Unexpected POST ${url}`));
    });

    putSpy = jest.spyOn(axios, "put").mockImplementation((url, body) => {
      if (url.includes("/api/v1/category/update-category/")) {
        return Promise.resolve({ data: { success: true } });
      }
      return Promise.reject(new Error(`Unexpected PUT ${url}`));
    });

    deleteSpy = jest.spyOn(axios, "delete").mockImplementation((url) => {
      if (url.includes("/api/v1/category/delete-category/")) {
        return Promise.resolve({ data: { success: true } });
      }
      return Promise.reject(new Error(`Unexpected DELETE ${url}`));
    });
  });

  afterEach(() => {
    getSpy?.mockRestore();
    postSpy?.mockRestore();
    putSpy?.mockRestore();
    deleteSpy?.mockRestore();
  });

  test("loads list, creates, updates via modal, deletes (UI path)", async () => {
    renderAt("/dashboard/admin/create-category");

    // initial list (from first GET sequence)
    await screen.findByText("Books");
    await screen.findByText("Electronics");

    // create
    const input = screen.getByPlaceholderText("Enter new category");
    fireEvent.change(input, { target: { value: "Toys" } });
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Toys is created"));

    // after create, next GET in sequence yields Toys
    await screen.findByText("Toys");

    // update Toys -> Kids Toys (open modal via edit on Toys row)
    const toysRow = getRowByName("Toys");
    fireEvent.click(within(toysRow).getByRole("button", { name: /edit/i }));

    const modal = screen.getByTestId("modal");
    await waitFor(() => expect(modal).toHaveAttribute("data-open", "true"));

    fireEvent.change(within(modal).getByPlaceholderText("Enter new category"), {
      target: { value: "Kids Toys" },
    });
    fireEvent.click(within(modal).getByRole("button", { name: /submit/i }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Kids Toys is updated"));

    // next GET in sequence yields Kids Toys
    await screen.findByText("Kids Toys");

    // delete Kids Toys
    const kidsRow = getRowByName("Kids Toys");
    fireEvent.click(within(kidsRow).getByRole("button", { name: /delete/i }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("category is deleted"));

    // final GET in sequence goes back to initial (no Kids Toys)
    await waitFor(() => {
      expect(screen.queryByText("Kids Toys")).not.toBeInTheDocument();
      expect(getRowByName("Books")).toBeInTheDocument();
      expect(getRowByName("Electronics")).toBeInTheDocument();
    });

    // header + 2 data rows
    expect(listRows().length).toBe(3);
  });

  test("unauthenticated: guard shows spinner redirect (no login form here)", async () => {
    localStorage.clear(); // ensure unauthenticated
    renderAt("/dashboard/admin/create-category");
    //AdminRoute shows a spinner/heading
    expect(await screen.findByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/redirecting to you in/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
/* C) Converge: full stack (UI → HTTP → real DB)
      – No axios mocks. Interact with the page and watch real changes. */
// ─────────────────────────────────────────────────────────────────────────────
describe("Converge: CreateCategory end-to-end (no API mocks)", () => {
  test("initial list, create, update, delete flows", async () => {
    await seedUsersAndInitialCategories();
    await authenticateAsAdmin();

    renderAt("/dashboard/admin/create-category");

    // initial list (Books/Electronics from real DB)
    await waitForCategoriesLoaded("Books", "Electronics");

    // create Toys
    const input = screen.getByPlaceholderText("Enter new category");
    fireEvent.change(input, { target: { value: "Toys" } });
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Toys is created"));
    await screen.findByText("Toys");

    // update Toys -> Kids Toys (modal)
    const toysRow = getRowByName("Toys");
    fireEvent.click(within(toysRow).getByRole("button", { name: /edit/i }));

    const modal = screen.getByTestId("modal");
    await waitFor(() => expect(modal).toHaveAttribute("data-open", "true"));

    fireEvent.change(within(modal).getByPlaceholderText("Enter new category"), {
      target: { value: "Kids Toys" },
    });
    fireEvent.click(within(modal).getByRole("button", { name: /submit/i }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Kids Toys is updated"));
    await screen.findByText("Kids Toys");

    // delete Kids Toys
    const kidsRow = getRowByName("Kids Toys");
    fireEvent.click(within(kidsRow).getByRole("button", { name: /delete/i }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("category is deleted"));

    // final check
    expect(screen.queryByText("Kids Toys")).not.toBeInTheDocument();
    expect(getRowByName("Books")).toBeInTheDocument();
    expect(getRowByName("Electronics")).toBeInTheDocument();
  });
});
