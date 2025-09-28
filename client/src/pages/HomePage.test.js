// Some tests written with help of AI
// HomePage.test.jsx
import React from "react";
import axios from "axios";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import HomePage from "./HomePage";

// --- Mocks ---
jest.mock("../styles/Homepages.css", () => ({}));

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

jest.mock("antd", () => {
  const React = require("react");

  // Checkbox: simple shim
  const Checkbox = ({ children, onChange, ...rest }) => (
    <label>
      <input
        type="checkbox"
        aria-label={typeof children === "string" ? children : undefined}
        onChange={(e) => onChange?.(e)}
        {...rest}
      />
      {children}
    </label>
  );

  // Radio shims with context to propagate onChange
  const RadioChangeCtx = React.createContext(null);

  const RadioGroup = ({ children, onChange }) => (
    <RadioChangeCtx.Provider value={onChange}>
      <div role="radiogroup">
        {React.Children.map(children, (child, idx) =>
          React.cloneElement(child, {
            key: child.key ?? `rg-${idx}`, // ensure unique key
          })
        )}
      </div>
    </RadioChangeCtx.Provider>
  );

  const Radio = ({ children, value }) => {
    const onChange = React.useContext(RadioChangeCtx);
    return (
      <button type="button" role="radio" onClick={() => onChange?.({ target: { value } })}>
        {children}
      </button>
    );
  };

  return { Checkbox, Radio: Object.assign(Radio, { Group: RadioGroup }) };
});

// Prices list
jest.mock("../components/Prices", () => ({
  Prices: [
    { _id: "price1", name: "$0–$10", array: [0, 10] },
    { _id: "price2", name: "$10–$20", array: [10, 20] },
  ],
}));

// Cart context
const mockSetCart = jest.fn();
jest.mock("../context/cart", () => ({
  __esModule: true,
  useCart: () => [[], mockSetCart],
}));

// toast
const mockToastSuccess = jest.fn();
jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { success: (msg) => mockToastSuccess(msg) },
  success: (msg) => mockToastSuccess(msg),
}));

// Layout
jest.mock("./../components/Layout", () => {
  const React = require("react");
  const LayoutMock = ({ children, title }) => (
    <div data-testid="layout" data-title={title}>
      {children}
    </div>
  );
  return { __esModule: true, default: LayoutMock };
});

jest.mock("axios");

// --- Test data helpers ---
const categories = [
  { _id: "c1", name: "Books" },
  { _id: "c2", name: "Games" },
];

const page1Products = [
  { _id: "p1", name: "Alpha", price: 1234, description: "Alpha description goes here", slug: "alpha-slug" },
  { _id: "p2", name: "Beta", price: 50, description: "Beta description comes here", slug: "beta-slug" },
];

const page2Products = [
  { _id: "p3", name: "Gamma", price: 9.99, description: "Gamma description", slug: "gamma-slug" },
];

const wireAxiosForInitialLoad = () => {
  axios.get.mockImplementation((url) => {
    if (url === "/api/v1/category/get-category")
      return Promise.resolve({ data: { success: true, category: categories } });
    if (url === "/api/v1/product/product-count")
      return Promise.resolve({ data: { total: 3 } });
    if (url === "/api/v1/product/product-list/1")
      return Promise.resolve({ data: { products: page1Products } });
    return Promise.resolve({ data: {} });
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  wireAxiosForInitialLoad();

  const store = {};
  jest.spyOn(window.localStorage.__proto__, "setItem").mockImplementation((k, v) => {
    store[k] = v;
  });

  delete window.location;
  window.location = { reload: jest.fn() };
});

describe("HomePage", () => {
  // Merged: layout title + banner image
  test("wraps content with Layout and renders banner", async () => {
    render(<HomePage />);
    const layout = await screen.findByTestId("layout");
    expect(layout).toHaveAttribute("data-title", "ALL Products - Best offers ");

    const img = await screen.findByAltText("bannerimage");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "/images/Virtual.png");
  });

  // Merged: initial product list + product image endpoint + price formatting
  test("loads first page of products on mount and renders product images/prices", async () => {
    render(<HomePage />);

    // Both products appear
    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    screen.getByText("Beta");

    // Product image endpoint
    const alphaImg = await screen.findByRole("img", { name: "Alpha" });
    expect(alphaImg).toHaveAttribute("src", "/api/v1/product/product-photo/p1");

    // Price formatting
    expect(screen.getByText("$1,234.00")).toBeInTheDocument();
  });

  test("Loadmore appends next page", async () => {
    axios.get.mockImplementation((url) => {
      if (url === "/api/v1/category/get-category")
        return Promise.resolve({ data: { success: true, category: categories } });
      if (url === "/api/v1/product/product-count")
        return Promise.resolve({ data: { total: 3 } });
      if (url === "/api/v1/product/product-list/1")
        return Promise.resolve({ data: { products: page1Products } });
      if (url === "/api/v1/product/product-list/2")
        return Promise.resolve({ data: { products: page2Products } });
      return Promise.resolve({ data: {} });
    });

    render(<HomePage />);
    await screen.findByText("Alpha");

    fireEvent.click(screen.getByRole("button", { name: /loadmore/i }));

    await waitFor(() => {
      expect(screen.getByText("Gamma")).toBeInTheDocument();
    });
  });

  test("navigates to product details", async () => {
    render(<HomePage />);
    const card = await screen.findByText("Alpha");
    const cardNode = card.closest(".card");
    const detailsBtn = within(cardNode).getByRole("button", { name: /more details/i });
    fireEvent.click(detailsBtn);
    expect(mockNavigate).toHaveBeenCalledWith("/product/alpha-slug");
  });

  test("adds item to cart and persists", async () => {
    render(<HomePage />);
    const card = await screen.findByText("Beta");
    const cardNode = card.closest(".card");
    const addBtn = within(cardNode).getByRole("button", { name: /add to cart/i });
    fireEvent.click(addBtn);

    expect(mockSetCart).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ _id: "p2" })]));
    expect(window.localStorage.setItem).toHaveBeenCalledWith("cart", expect.stringContaining('"slug":"beta-slug"'));
    expect(mockToastSuccess).toHaveBeenCalledWith("Item Added to cart");
  });

  test("category filter triggers filtered fetch and updates list", async () => {
    axios.post = jest.fn().mockResolvedValue({ data: { products: [page1Products[1]] } });

    render(<HomePage />);
    const books = await screen.findByLabelText("Books");
    fireEvent.click(books);

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith("/api/v1/product/product-filters", {
        checked: expect.arrayContaining(["c1"]),
        radio: [],
      });
      expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
      expect(screen.getByText("Beta")).toBeInTheDocument();
    });
  });

  test("unchecking a category clears it and reloads full list", async () => {
    axios.post = jest.fn().mockResolvedValue({ data: { products: [page1Products[1]] } });

    render(<HomePage />);
    await screen.findByText("Alpha");
    screen.getByText("Beta");

    const books = await screen.findByLabelText("Books");
    fireEvent.click(books);

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalled();
      expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
    });

    // Uncheck -> reload first page again
    fireEvent.click(books);

    await waitFor(() => {
      expect(screen.getByText("Alpha")).toBeInTheDocument();
      expect(screen.getByText("Beta")).toBeInTheDocument();
    });
  });

  test("price radio filter triggers filtered fetch", async () => {
    axios.post = jest.fn().mockResolvedValue({ data: { products: [page1Products[1]] } });

    render(<HomePage />);
    await screen.findByText("Alpha");

    const priceBtn = screen.getByRole("radio", { name: "$0–$10" });
    fireEvent.click(priceBtn);

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith("/api/v1/product/product-filters", {
        checked: [],
        radio: [0, 10],
      });
    });
  });

  test("RESET FILTERS calls window.location.reload", async () => {
    render(<HomePage />);
    await screen.findByText("Alpha");
    fireEvent.click(screen.getByRole("button", { name: /reset filters/i }));
    expect(window.location.reload).toHaveBeenCalled();
  });

  test("Loadmore shows 'Loading ...' while request is in-flight", async () => {
    let resolvePage2;
    axios.get.mockImplementation((url) => {
      if (url === "/api/v1/category/get-category")
        return Promise.resolve({ data: { success: true, category: categories } });
      if (url === "/api/v1/product/product-count")
        return Promise.resolve({ data: { total: 3 } });
      if (url === "/api/v1/product/product-list/1")
        return Promise.resolve({ data: { products: page1Products } });
      if (url === "/api/v1/product/product-list/2")
        return new Promise((res) => { resolvePage2 = res; }); // keep pending
      return Promise.resolve({ data: {} });
    });

    render(<HomePage />);
    await screen.findByText("Alpha");

    const btn = screen.getByRole("button", { name: /loadmore/i });
    fireEvent.click(btn);

    expect(screen.getByText(/loading\s*\.\.\./i)).toBeInTheDocument();

    resolvePage2({ data: { products: page2Products } });

    await waitFor(() => {
      expect(screen.getByText("Gamma")).toBeInTheDocument();
    });
  });

  // --- Error paths & edge cases for coverage ---
  test("gracefully handles product count fetch error", async () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    axios.get.mockImplementation((url) => {
      if (url === "/api/v1/category/get-category")
        return Promise.resolve({ data: { success: true, category: categories } });
      if (url === "/api/v1/product/product-count")
        return Promise.reject(new Error("boom"));
      if (url === "/api/v1/product/product-list/1")
        return Promise.resolve({ data: { products: page1Products } });
      return Promise.resolve({ data: {} });
    });

    render(<HomePage />);
    await screen.findByText("Alpha");
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  test("handles category fetch failure (catch path)", async () => {
    const spy = jest.spyOn(console, "log").mockImplementation(() => {});
    axios.get.mockImplementation((url) => {
      if (url === "/api/v1/category/get-category") return Promise.reject(new Error("boom"));
      if (url === "/api/v1/product/product-count") return Promise.resolve({ data: { total: 2 } });
      if (url === "/api/v1/product/product-list/1") return Promise.resolve({ data: { products: page1Products } });
      return Promise.resolve({ data: {} });
    });

    render(<HomePage />);
    await screen.findByText("All Products");
    expect(spy).toHaveBeenCalled();
  });

  test("handles initial product list failure (catch path)", async () => {
    const spy = jest.spyOn(console, "log").mockImplementation(() => {});
    axios.get.mockImplementation((url) => {
      if (url === "/api/v1/category/get-category") return Promise.resolve({ data: { success: true, category: categories } });
      if (url === "/api/v1/product/product-count") return Promise.resolve({ data: { total: 2 } });
      if (url === "/api/v1/product/product-list/1") return Promise.reject(new Error("list fail"));
      return Promise.resolve({ data: {} });
    });

    render(<HomePage />);
    await screen.findByText("All Products");
    expect(spy).toHaveBeenCalled();
  });

  test("hides Loadmore when products >= total", async () => {
    axios.get.mockImplementation((url) => {
      if (url === "/api/v1/category/get-category") return Promise.resolve({ data: { success: true, category: categories } });
      if (url === "/api/v1/product/product-count") return Promise.resolve({ data: { total: 2 } });
      if (url === "/api/v1/product/product-list/1") return Promise.resolve({ data: { products: page1Products } });
      return Promise.resolve({ data: {} });
    });

    render(<HomePage />);
    await screen.findByText("Alpha");
    expect(screen.queryByRole("button", { name: /loadmore/i })).toBeNull();
  });

  test("handles loadMore failure (catch path)", async () => {
    const spy = jest.spyOn(console, "log").mockImplementation(() => {});
    axios.get.mockImplementation((url) => {
      if (url === "/api/v1/category/get-category") return Promise.resolve({ data: { success: true, category: categories } });
      if (url === "/api/v1/product/product-count") return Promise.resolve({ data: { total: 3 } });
      if (url === "/api/v1/product/product-list/1") return Promise.resolve({ data: { products: page1Products } });
      if (url === "/api/v1/product/product-list/2") return Promise.reject(new Error("loadmore fail"));
      return Promise.resolve({ data: {} });
    });

    render(<HomePage />);
    await screen.findByText("Alpha");

    fireEvent.click(screen.getByRole("button", { name: /loadmore/i }));

    await waitFor(() => {
      expect(screen.queryByText("Gamma")).toBeNull();
      expect(spy).toHaveBeenCalled();
    });
  });
});
