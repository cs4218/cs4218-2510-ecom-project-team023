/** @jest-environment jsdom */

/* ---------- jsdom polyfills ---------- */
import { TextEncoder, TextDecoder } from "util";
if (!global.TextEncoder) global.TextEncoder = TextEncoder;
if (!global.TextDecoder) global.TextDecoder = TextDecoder;
if (!global.crypto) global.crypto = require("crypto").webcrypto;

import "@testing-library/jest-dom";
import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import axios from "axios";

/* -------------------- MOCK SERVER-SIDE BRAINTREE (IMPORTANT) -------------------- */
/* Must be declared BEFORE importing server.js so the backend uses this mock */
const mockBtSale = jest.fn((payload, cb) =>
  cb(null, {
    success: true,
    transaction: {
      id: "txn_123",
      status: "submitted_for_settlement",
      amount: String(payload?.amount ?? "0"),
    },
  })
);

jest.mock("braintree", () => {
  class BraintreeGateway {
    constructor() {
      this.transaction = { sale: (...args) => mockBtSale(...args) };
      this.clientToken = {
        generate: (_opts, cb) => cb(null, { clientToken: "tok_abc" }),
      };
    }
  }
  const Environment = { Sandbox: "Sandbox" };
  return {
    __esModule: true,
    default: { BraintreeGateway, Environment },
    BraintreeGateway,
    Environment,
  };
});

/* -------------------- DB helpers & app (now that mocks are set) -------------------- */
import {
  connectToTestDb,
  disconnectFromTestDb,
  resetTestDb,
} from "../../../config/testdb.js";
import app from "../../../server.js";

/* -------------------- Models & helpers -------------------- */
import userModel from "../../../models/userModel.js";
import productModel from "../../../models/productModel.js";
import categoryModel from "../../../models/categoryModel.js";
import { hashPassword } from "../../../helpers/authHelper.js";

/* -------------------- Page under test -------------------- */
import CartPage from "./CartPage.js";

/* ---------------- Stable UI mocks (match your other FE tests) ---------------- */
jest.mock("../components/Layout", () => ({ children }) => (
  <div data-testid="layout">{children}</div>
));

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

/* ------------------------- Mock only the hooks -------------------------- */
// Auth hook (provide user + token)
jest.mock("../context/auth", () => {
  const setAuth = jest.fn();
  let state = [{ user: null, token: "" }, setAuth]; // [auth, setAuth]
  const useAuth = () => state;
  const __setAuthState = (next) => (state = next);
  return { useAuth, __setAuthState };
});

// Cart hook (provide cart items)
jest.mock("../context/cart", () => {
  const setCart = jest.fn();
  let state = [[], setCart]; // [cart, setCart]
  const useCart = () => state;
  const __setCartState = (next) => (state = next);
  return { useCart, __setCartState };
});

/* ----------- Braintree drop-in shell (client widget mock) ------------- */
let mockDropinBehavior = {
  requestPaymentMethod: () => Promise.resolve({ nonce: "fake-nonce" }),
};
jest.mock("braintree-web-drop-in-react", () => {
  const React = require("react");
  const DropInMock = ({ onInstance }) => {
    const ref = React.useRef(null);
    React.useEffect(() => {
      if (!ref.current) {
        ref.current = {
          requestPaymentMethod: (...args) =>
            mockDropinBehavior.requestPaymentMethod(...args),
          teardown: async () => {},
        };
        onInstance(ref.current);
      }
    }, []);
    return <div data-testid="bt-dropin" />;
  };
  return { __esModule: true, default: DropInMock };
});

/* -------------------------- Test helpers / wiring ----------------------- */
let server;
let port;

const renderWithRouter = (ui, initialEntries = ["/cart"]) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/cart" element={ui} />
        <Route path="/orders" element={<div data-testid="orders">Orders</div>} />
        <Route path="/" element={<div data-testid="home">Home</div>} />
      </Routes>
    </MemoryRouter>
  );

// “Make Payment” button may or may not have a testid.
// Try testid first, then fall back to the accessible name.
const findPayBtn = async () => {
  const byTid = screen.queryByTestId("make-payment-btn");
  if (byTid) return byTid;
  return await screen.findByRole("button", { name: /make payment/i });
};

const waitForPayEnabled = async () => {
  const btn = await findPayBtn();
  await waitFor(() => expect(btn).toBeEnabled(), { timeout: 5000 });
  return btn;
};

/* --------------------------------- Lifecycle ---------------------------- */
beforeAll(async () => {
  jest.setTimeout(30000);
  await connectToTestDb("fe_be_cart_checkout_int");
});

afterAll(async () => {
  await disconnectFromTestDb();
});

beforeEach(async () => {
  jest.clearAllMocks();
  await resetTestDb();

  // Start real backend server and point axios at it
  server = app.listen(0);
  port = server.address().port;
  axios.defaults.baseURL = `http://localhost:${port}`;

  // Seed category + products (NOTE: price matches UI payload to avoid 422 on happy path)
  const cat = await categoryModel.create({
    name: "Peripherals",
    slug: "peripherals",
  });
  const [p1, p2] = await productModel.create([
    {
      name: "Laptop",
      slug: "laptop",
      description: "Powerful",
      price: 899, // match what CartPage posts
      quantity: 10,
      category: cat._id,
      shipping: 1,
    },
    {
      name: "Mouse",
      slug: "mouse",
      description: "Wireless",
      price: 25,
      quantity: 7,
      category: cat._id,
      shipping: 1,
    },
  ]);

  // Seed a real user and login to get JWT
  const hashed = await hashPassword("strongpass");
  await userModel.create({
    name: "Buyer",
    email: "buyer@example.com",
    password: hashed,
    phone: "91234567",
    address: "123 Street",
    answer: "Football",
  });
  const login = await axios.post("/api/v1/auth/login", {
    email: "buyer@example.com",
    password: "strongpass",
  });
  const token = login.data?.token;

  // Set both header casings to satisfy any middleware
  axios.defaults.headers.common.Authorization = token;
  axios.defaults.headers.common.authorization = token;

  // Prime mocked Auth hook with user + token
  const { __setAuthState } = jest.requireMock("../context/auth");
  __setAuthState([
    {
      user: { name: "Buyer", address: "123 Street", _id: login.data?.user?._id },
      token,
    },
    jest.fn(),
  ]);

  // Seed localStorage cart and prime mocked Cart hook
  window.localStorage.clear();
  const seededCart = [
    {
      _id: p1._id.toString(),
      name: p1.name,
      price: p1.price,
      description: p1.description,
      slug: p1.slug,
    },
    {
      _id: p2._id.toString(),
      name: p2.name,
      price: p2.price,
      description: p2.description,
      slug: p2.slug,
    },
  ];
  window.localStorage.setItem("cart", JSON.stringify(seededCart));
  const { __setCartState } = jest.requireMock("../context/cart");
  __setCartState([seededCart, jest.fn()]);

  // Default: drop-in returns a nonce
  mockDropinBehavior.requestPaymentMethod = () =>
    Promise.resolve({ nonce: "fake-nonce" });
});

afterEach(async () => {
  jest.setTimeout(30000);
  await new Promise((r) => setTimeout(r, 20));
  if (server && server.close) {
    await new Promise((res) => server.close(res));
  }
});

/* ---------------------------------- Tests -------------------------------- */
describe("CartPage • FE↔BE checkout (UI→axios→server→DB)", () => {
  test("happy path: token fetched, drop-in shown, payment succeeds → cart clears", async () => {
    renderWithRouter(<CartPage />);

    // client token fetched → drop-in visible
    await waitFor(
      async () => {
        expect(await screen.findByTestId("bt-dropin")).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    const btn = await waitForPayEnabled();
    await act(async () => {
      await userEvent.click(btn);
    });

    // Success effect: cart cleared → button disappears
    await waitFor(
      () =>
        expect(
          screen.queryByTestId("make-payment-btn") ||
            screen.queryByRole("button", { name: /make payment/i })
        ).not.toBeInTheDocument(),
      { timeout: 5000 }
    );
  });

  test("price mismatch (server validation) → rejects and UI stays", async () => {
    // mismatch first item so backend rejects pre-sale
    const current = JSON.parse(window.localStorage.getItem("cart"));
    current[0].price = current[0].price - 100; // force mismatch
    window.localStorage.setItem("cart", JSON.stringify(current));
    const { __setCartState } = jest.requireMock("../context/cart");
    __setCartState([current, jest.fn()]);

    renderWithRouter(<CartPage />);

    await waitFor(
      async () => {
        expect(await screen.findByTestId("bt-dropin")).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    const btn = await waitForPayEnabled();
    await act(async () => {
      await userEvent.click(btn);
    });

    // Failure effect: button still present (no success)
    expect(
      screen.queryByTestId("make-payment-btn") ||
        screen.getByRole("button", { name: /make payment/i })
    ).toBeInTheDocument();
  });

  test("drop-in cancels / nonce failure → UI remains", async () => {
    mockDropinBehavior.requestPaymentMethod = () =>
      Promise.reject(
        Object.assign(new Error("User canceled"), { code: "USER_CANCELED" })
      );

    renderWithRouter(<CartPage />);

    await waitFor(
      async () => {
        expect(await screen.findByTestId("bt-dropin")).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    const btn = await waitForPayEnabled();
    await act(async () => {
      await userEvent.click(btn);
    });

    // Button still present (no success)
    expect(
      screen.queryByTestId("make-payment-btn") ||
        screen.getByRole("button", { name: /make payment/i })
    ).toBeInTheDocument();
  });
});
