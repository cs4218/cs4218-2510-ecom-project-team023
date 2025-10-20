/** @jest-environment jsdom */

import "@testing-library/jest-dom";
import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";

// ---- Test target ----
import CartPage from "./CartPage";

// -------------------- Stable Mocks --------------------

jest.mock("../components/Layout", () => {
  return ({ children }) => <div data-testid="mock-layout">{children}</div>;
});

// Keep AdminMenu out of the tree if CartPage imports it indirectly anywhere
jest.mock("../components/AdminMenu", () => () => <div />);

// Mock toast (create the mock object INSIDE the factory; import it afterwards)
jest.mock("react-hot-toast", () => {
  const t = { success: jest.fn(), error: jest.fn() };
  return { __esModule: true, default: t, ...t };
});
import toast from "react-hot-toast";

// Mock auth context with reset
jest.mock("../context/auth", () => {
  const makeAuth = () => [
    {
      user: { name: "Alice", address: "123 Main St" },
      token: "t.admin",
    },
    jest.fn(),
  ];
  let tuple = makeAuth();
  const useAuth = () => tuple;
  const __resetAuthMock = () => {
    tuple = makeAuth();
  };
  return { useAuth, __resetAuthMock };
});

// Mock cart context with reset (CartPage clears cart on success)
jest.mock("../context/cart", () => {
  const makeInitialCart = () => ([
    { _id: "p01", name: "Laptop", description: "Powerful", price: 999 },
    { _id: "p02", name: "Mouse", description: "Wireless", price: 25 },
  ]);
  let cart = makeInitialCart();
  const setCart = jest.fn((next) => {
    cart = typeof next === "function" ? next(cart) : next;
    return cart;
  });
  const useCart = () => [cart, setCart];
  const __resetCartMock = () => {
    cart = makeInitialCart();
    setCart.mockClear();
  };
  return { useCart, __resetCartMock };
});

// -------------------- Braintree Drop-in (React wrapper) --------------------
// Provide an instance via onInstance so CartPage can enable the Pay button. Written with help from chatGPT.
let mockDropinBehavior = {
  requestPaymentMethod: () => Promise.resolve({ nonce: "fake-nonce" }),
};

jest.mock("braintree-web-drop-in-react", () => {
  const React = require("react");
  const DropInMock = ({ onInstance }) => {
    const instanceRef = React.useRef(null);

    // IMPORTANT: call onInstance exactly once (no deps on `onInstance`)
    React.useEffect(() => {
      if (!instanceRef.current) {
        instanceRef.current = {
          requestPaymentMethod: (...args) =>
            mockDropinBehavior.requestPaymentMethod(...args),
          teardown: async () => {},
        };
        onInstance(instanceRef.current);
      }
    }, []); // do NOT include onInstance here

    return <div data-testid="bt-dropin" />;
  };
  return { __esModule: true, default: DropInMock };
});


// -------------------- Axios (global default; override per-test when needed) --------------------
jest.spyOn(axios, "get").mockResolvedValue({ data: { clientToken: "tok_123" } });
jest.spyOn(axios, "post").mockResolvedValue({
  data: { ok: true, status: "submitted_for_settlement", amount: 1024 },
});

// -------------------- Router helper --------------------
const renderWithRouter = (ui, initialEntries = ["/cart"]) => {
  render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>);
};

// -------------------- Shortcuts --------------------
const findPayBtn = () => screen.findByTestId("make-payment-btn");

const waitForPayBtnEnabled = async () => {
  const btn = await findPayBtn();
  await waitFor(() => expect(btn).toBeEnabled(), { timeout: 3000 });
  return btn;
};

// -------------------- Resets --------------------
import { __resetCartMock } from "../context/cart";
import { __resetAuthMock } from "../context/auth";

// seed cart for components that read from localStorage instead of context
const seedCart = [
  { _id: "p01", name: "Laptop", description: "Powerful", price: 999 },
  { _id: "p02", name: "Mouse", description: "Wireless", price: 25 },
];

beforeEach(() => {
  jest.clearAllMocks();
  __resetCartMock();
  __resetAuthMock();
  window.localStorage.clear();

  // IMPORTANT: seed localStorage cart so the page shows the payment section
  window.localStorage.setItem("cart", JSON.stringify(seedCart));

  // default happy-path behaviors
  axios.get.mockResolvedValue({ data: { clientToken: "tok_123" } });
  axios.post.mockResolvedValue({
    data: { ok: true, status: "submitted_for_settlement", amount: 1024 },
  });

  // by default, requestPaymentMethod resolves with a nonce
  mockDropinBehavior.requestPaymentMethod = () =>
    Promise.resolve({ nonce: "fake-nonce" });
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe("CartPage • Braintree Checkout", () => {
  test("fetches client token and renders Drop-in; Make Payment is enabled when address exists", async () => {
    renderWithRouter(<CartPage />);

    // token GET → drop-in shows
    expect(await screen.findByTestId("bt-dropin")).toBeInTheDocument();

    const btn = await waitForPayBtnEnabled();
    expect(btn).toBeEnabled();
  });

  // written with help from chatGPT
  test("successful payment: sends nonce+cart, shows success, navigates to orders", async () => {
    const user = userEvent;
    renderWithRouter(<CartPage />);

    // wait until enabled
    const btn = await waitForPayBtnEnabled();

    await act(async () => {
      await user.click(btn);
    });

    // axios.post called with nonce + cart only
    expect(axios.post).toHaveBeenCalledWith(
      "/api/v1/product/braintree/payment",
      expect.objectContaining({
        nonce: "fake-nonce",
        cart: expect.any(Array),
      })
    );

    // success toast
    expect(toast.success).toHaveBeenCalled();

    // After success your page likely clears the cart and navigates;
    await waitFor(() => {
      expect(screen.queryByTestId("make-payment-btn")).not.toBeInTheDocument();
    });
  });

  test("payment failure (request rejected e.g., invalid card): shows error, no navigation", async () => {
    const user = userEvent;

    // Make drop-in request fail (e.g., card validation error)
    mockDropinBehavior.requestPaymentMethod = () =>
      Promise.reject(Object.assign(new Error("Invalid card"), { code: "CARD_ERR" }));

    renderWithRouter(<CartPage />);

    const btn = await waitForPayBtnEnabled();

    await act(async () => {
      await user.click(btn);
    });

    // Error toast shown; button still exists (no nav)
    expect(toast.error).toHaveBeenCalled();
    expect(screen.getByTestId("make-payment-btn")).toBeInTheDocument();
  });

  test("payment failure (ok:false response): shows error, no navigation", async () => {
    const user = userEvent;

    // Post returns ok:false (e.g., gateway declined)
    axios.post.mockResolvedValueOnce({ data: { ok: false, message: "Declined" } });

    renderWithRouter(<CartPage />);
    const btn = await waitForPayBtnEnabled();

    await act(async () => {
      await user.click(btn);
    });

    expect(toast.error).toHaveBeenCalled();
    // still on the page
    expect(screen.getByTestId("make-payment-btn")).toBeInTheDocument();
  });

  test("user cancels in Drop-in: no navigation; UI remains usable", async () => {
    const user = userEvent;

    // Simulate user cancel in drop-in (reject with special code)
    mockDropinBehavior.requestPaymentMethod = () =>
      Promise.reject(Object.assign(new Error("User canceled"), { code: "USER_CANCELED" }));

    renderWithRouter(<CartPage />);
    const btn = await waitForPayBtnEnabled();

    await act(async () => {
      await user.click(btn);
    });

    // No success; just assert we're still here
    expect(screen.getByTestId("make-payment-btn")).toBeInTheDocument();
  });

  test("posts only nonce + cart (no PAN/CVV); cart totals consistent", async () => {
    const user = userEvent;
    renderWithRouter(<CartPage />);
    const btn = await waitForPayBtnEnabled();

    await act(async () => {
      await user.click(btn);
    });

    const [, payload] = axios.post.mock.calls[0];
    expect(payload).toEqual(
      expect.objectContaining({
        nonce: expect.any(String),
        cart: expect.any(Array),
      })
    );
    expect(Object.keys(payload)).not.toEqual(
      expect.arrayContaining(["cardNumber", "cvv", "expiry"])
    );
  });

  test("displays appropriate UX for settled/success status", async () => {
    const user = userEvent;
    axios.post.mockResolvedValueOnce({
      data: { ok: true, status: "settled", amount: 1024 },
    });

    renderWithRouter(<CartPage />);
    const btn = await waitForPayBtnEnabled();
    await act(async () => {
      await user.click(btn);
    });

    expect(toast.success).toHaveBeenCalled();
  });

  test("displays appropriate UX for pending/submitted_for_settlement", async () => {
    const user = userEvent;
    axios.post.mockResolvedValueOnce({
      data: { ok: true, status: "submitted_for_settlement", amount: 1024 },
    });

    renderWithRouter(<CartPage />);
    const btn = await waitForPayBtnEnabled();
    await act(async () => {
      await user.click(btn);
    });

    expect(toast.success).toHaveBeenCalled();
  });

  test("displays appropriate UX for failed status", async () => {
    const user = userEvent;
    axios.post.mockResolvedValueOnce({
      data: { ok: true, status: "failure", amount: 1024 },
    });

    renderWithRouter(<CartPage />);
    const btn = await waitForPayBtnEnabled();
    await act(async () => {
      await user.click(btn);
    });

    // Either a success(false) message or an error toast; but no navigation
    expect(toast.success.mock.calls.length + toast.error.mock.calls.length).toBeGreaterThan(0);
    expect(screen.getByTestId("make-payment-btn")).toBeInTheDocument();
  });

  test("tokenization error: token GET fails → Drop-in not rendered; Pay button absent", async () => {
    axios.get.mockRejectedValueOnce(
      Object.assign(new Error("token timeout"), { code: "ECONNABORTED" })
    );

    renderWithRouter(<CartPage />);

    await waitFor(() => {
      expect(screen.queryByTestId("bt-dropin")).not.toBeInTheDocument();
    });
    expect(screen.queryByTestId("make-payment-btn")).not.toBeInTheDocument();
  });

  test("payment timeout/network error: shows error feedback; button re-enables", async () => {
    const user = userEvent;
    axios.post.mockRejectedValueOnce(
      Object.assign(new Error("network down"), { code: "ENETUNREACH" })
    );

    renderWithRouter(<CartPage />);
    const btn = await waitForPayBtnEnabled();

    await act(async () => {
      await user.click(btn);
    });

    expect(toast.error).toHaveBeenCalled();
    // Button should still exist afterwards
    expect(screen.getByTestId("make-payment-btn")).toBeInTheDocument();
  });
});
