// Some tests written with help of AI
// client/src/pages/admin/UpdateProduct.test.js
import React from "react";
import axios from "axios";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";

// -------------------- Mocks (declare BEFORE requiring SUT) --------------------
jest.mock("axios");

// Mock Layout to expose title
jest.mock("../../components/Layout", () => {
  const React = require("react");
  const Layout = ({ children, title }) => (
    <div data-testid="layout" data-title={title}>
      {children}
    </div>
  );
  return { __esModule: true, default: Layout };
});

// Mock AdminMenu
jest.mock("../../components/AdminMenu", () => {
  const React = require("react");
  const AdminMenu = () => <nav data-testid="admin-menu" />;
  return { __esModule: true, default: AdminMenu };
});

// antd Select mock (shows listbox + clickable buttons and surfaces some props)
jest.mock("antd", () => {
  const React = require("react");

  const Select = ({
    children,
    placeholder,
    className,
    onChange,
    value,
    size,
    showSearch,
    ...rest
  }) => {
    const ariaLabel = rest["aria-label"] || placeholder || "Select";
    return (
      <div className={className || "form-select mb-3"}>
        <div
          role="listbox"
          aria-label={ariaLabel}
          data-testid="select-display"
          data-size={size}
          data-showsearch={!!showSearch}
          data-value={value ?? ""}
        />
        <div>
          {React.Children.map(children, (child, idx) => {
            if (!child) return null;
            const { value: v, children: label } = child.props || {};
            return (
              <button type="button" onClick={() => onChange?.(v)} key={idx}>
                {label}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const Option = ({ children }) => <>{children}</>;
  Select.Option = Option;

  return { __esModule: true, Select };
});

// toast
const mockToast = { success: jest.fn(), error: jest.fn() };
jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    success: (m) => mockToast.success(m),
    error: (m) => mockToast.error(m),
  },
}));

// router
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  __esModule: true,
  useNavigate: () => mockNavigate,
  useParams: () => ({ slug: "cool-product" }),
}));

// URL.createObjectURL for preview
beforeAll(() => {
  global.URL.createObjectURL = jest.fn(() => "blob:preview");
});

// -------------------- Require SUT AFTER mocks --------------------
const UpdateProduct = require("./UpdateProduct").default;

// -------------------- Fixtures & helpers --------------------
const categories = [
  { _id: "c1", name: "Books" },
  { _id: "c2", name: "Games" },
];

const product = {
  _id: "p1",
  name: "Widget",
  description: "A nice widget",
  price: 42,
  quantity: 10,
  shipping: true,
  category: { _id: "c1" },
};

const wireAxiosHappy = () => {
  axios.get.mockImplementation((url) => {
    if (url.startsWith("/api/v1/product/get-product/")) {
      return Promise.resolve({ data: { product } });
    }
    if (url === "/api/v1/category/get-category") {
      return Promise.resolve({ data: { success: true, category: categories } });
    }
    return Promise.resolve({ data: {} });
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  wireAxiosHappy();
});

const clickOptionWithinSelect = async (listbox, optionText) => {
  const btn = await within(listbox.parentElement).findByRole("button", {
    name: optionText,
  });
  fireEvent.click(btn);
};

const captureFormData = () => {
  const appended = [];
  class MockFormData {
    append(k, v) {
      appended.push([k, v]);
    }
  }
  const original = global.FormData;
  global.FormData = MockFormData;
  return {
    appended,
    restore: () => {
      global.FormData = original;
    },
  };
};

const fillWithCurrentValuesThen = async (overrides = {}) => {
  // Assumes product fields have been loaded.
  const {
    name = product.name,
    description = product.description,
    price = String(product.price),
    quantity = String(product.quantity),
    categoryLabel, // optional change via Select
    shippingLabel, // optional change via Select
    file, // optional photo
  } = overrides;

  // Change text fields
  fireEvent.change(screen.getByPlaceholderText(/write a name/i), {
    target: { value: name },
  });
  fireEvent.change(screen.getByPlaceholderText(/write a description/i), {
    target: { value: description },
  });
  fireEvent.change(screen.getByPlaceholderText(/write a price/i), {
    target: { value: price },
  });
  fireEvent.change(screen.getByPlaceholderText(/write a quantity/i), {
    target: { value: quantity },
  });

  if (categoryLabel) {
    const catBox = screen.getByRole("listbox", { name: /select a category/i });
    await clickOptionWithinSelect(catBox, categoryLabel);
  }
  if (shippingLabel) {
    const shipBox = screen.getByRole("listbox", { name: /select shipping/i });
    await clickOptionWithinSelect(shipBox, shippingLabel);
  }
  if (file !== undefined) {
    const fileInput = document.querySelector('input[name="photo"]');
    fireEvent.change(fileInput, { target: { files: file ? [file] : [] } });
  }
};

// -------------------- Smoke / Baseline --------------------
describe("UpdateProduct — smoke / baseline", () => {
  test("renders layout, title, menus, selects and product prefill", async () => {
    render(<UpdateProduct />);

    const layout = await screen.findByTestId("layout");
    expect(layout).toHaveAttribute("data-title", "Dashboard - Update Product");
    expect(screen.getByTestId("admin-menu")).toBeInTheDocument();

    // Unique heading role avoids duplicate text ambiguity
    await screen.findByRole("heading", { name: /update product/i });

    // Category Select props surfaced by mock
    const catBox = await screen.findByRole("listbox", {
      name: /select a category/i,
    });
    expect(catBox).toHaveAttribute("data-size", "large");
    expect(catBox).toHaveAttribute("data-showsearch", "true");

    // Shipping Select exists
    expect(
      screen.getByRole("listbox", { name: /select shipping/i })
    ).toBeInTheDocument();

    // Product prefill present
    await screen.findByDisplayValue("Widget");
  });

  test("photo branch toggles between server image and local preview", async () => {
    render(<UpdateProduct />);
    await screen.findByDisplayValue("Widget");

    // Initially uses server image
    let img = screen.getByAltText("product_photo");
    expect(img.getAttribute("src")).toBe("/api/v1/product/product-photo/p1");

    // Select local file → preview
    const fileInput = document.querySelector('input[name="photo"]');
    const file = new File(["x"], "pic.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    img = await screen.findByAltText("product_photo");
    expect(img.getAttribute("src")).toBe("blob:preview");

    // Clear file → back to server
    fireEvent.change(fileInput, { target: { files: [] } });
    await waitFor(() => {
      const imgBack = screen.getByAltText("product_photo");
      expect(imgBack.getAttribute("src")).toBe(
        "/api/v1/product/product-photo/p1"
      );
    });
  });

  test("happy path update: sends FormData, toasts, and navigates", async () => {
    axios.put.mockResolvedValueOnce({ data: { success: true } });
    const { appended, restore } = captureFormData();

    render(<UpdateProduct />);
    await screen.findByRole("heading", { name: /update product/i });

    await fillWithCurrentValuesThen({
      name: "Widget v2",
      description: "Even nicer",
      categoryLabel: "Games",
      file: new File(["x"], "upd.png", { type: "image/png" }),
    });

    fireEvent.click(screen.getByRole("button", { name: /update product/i }));

    await waitFor(() => {
      expect(axios.put).toHaveBeenCalledWith(
        "/api/v1/product/update-product/p1",
        expect.any(FormData)
      );
      expect(mockToast.success).toHaveBeenCalledWith(
        "Product Updated Successfully"
      );
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard/admin/products");
    });

    const asMap = Object.fromEntries(appended);
    expect(asMap.name).toBe("Widget v2");
    expect(asMap.description).toBe("Even nicer");
    expect(String(asMap.price)).toBe("42");
    expect(String(asMap.quantity)).toBe("10");
    expect(asMap.category).toBe("c2");
    expect(asMap.shipping).toBe("1"); // initial product.shipping true
    expect(asMap.photo).toBeInstanceOf(File);

    restore();
  });

  test("server failure (success:false) → toast.error and no navigate", async () => {
    axios.put.mockResolvedValueOnce({
      data: { success: false, message: "invalid fields" },
    });

    render(<UpdateProduct />);
    await screen.findByRole("heading", { name: /update product/i });

    fireEvent.click(screen.getByRole("button", { name: /update product/i }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("invalid fields");
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test("network failure (catch) → generic toast.error", async () => {
    axios.put.mockRejectedValueOnce(new Error("network down"));

    render(<UpdateProduct />);
    await screen.findByRole("heading", { name: /update product/i });

    fireEvent.click(screen.getByRole("button", { name: /update product/i }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("something went wrong");
    });
  });

  test("getAllCategory: success=false leaves options empty; no toast", async () => {
    axios.get.mockReset();
    axios.get.mockImplementation((url) => {
      if (url.startsWith("/api/v1/product/get-product/")) {
        return Promise.resolve({ data: { product } });
      }
      if (url === "/api/v1/category/get-category") {
        return Promise.resolve({ data: { success: false } });
      }
      return Promise.resolve({ data: {} });
    });

    render(<UpdateProduct />);
    const catBox = await screen.findByRole("listbox", {
      name: /select a category/i,
    });

    await waitFor(() => {
      expect(within(catBox.parentElement).queryAllByRole("button").length).toBe(
        0
      );
      expect(mockToast.error).not.toHaveBeenCalled();
    });
  });

  test("getAllCategory catch → toasts 'Something went wrong in getting category'", async () => {
    axios.get.mockReset();
    axios.get.mockImplementation((url) => {
      if (url.startsWith("/api/v1/product/get-product/")) {
        return Promise.resolve({ data: { product } });
      }
      if (url === "/api/v1/category/get-category") {
        return Promise.reject(new Error("boom"));
      }
      return Promise.resolve({ data: {} });
    });

    render(<UpdateProduct />);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        "Something went wrong in getting category"
      );
    });
  });
});

// -------------------- EP / BVA suites --------------------
describe("UpdateProduct — EP/BVA for inputs", () => {
  beforeEach(async () => {
    render(<UpdateProduct />);
    await screen.findByRole("heading", { name: /update product/i });
    // Ensure product is loaded
    await screen.findByDisplayValue("Widget");
  });

  describe("Price (EP/BVA)", () => {
    const table = [
      { label: "empty", value: "", ok: false, msg: "price required" },
      { label: "negative", value: "-1", ok: false, msg: "invalid price" },
      { label: "zero (lower bound)", value: "0", ok: true },
      { label: "one", value: "1", ok: true },
      { label: "decimal", value: "9.99", ok: true },
      { label: "very large", value: "999999999", ok: true },
    ];

    test.each(table)("price %s → server %s", async ({ value, ok, msg }) => {
      if (ok) {
        axios.put.mockResolvedValueOnce({ data: { success: true } });
      } else {
        axios.put.mockResolvedValueOnce({
          data: { success: false, message: msg },
        });
      }

      await fillWithCurrentValuesThen({ price: value });
      fireEvent.click(screen.getByRole("button", { name: /update product/i }));

      if (ok) {
        await waitFor(() => {
          expect(mockToast.success).toHaveBeenCalled();
          expect(mockNavigate).toHaveBeenCalled();
        });
      } else {
        await waitFor(() => {
          expect(mockToast.error).toHaveBeenCalledWith(msg);
        });
        expect(mockNavigate).not.toHaveBeenCalled();
      }
    });
  });

  describe("Quantity (EP/BVA)", () => {
    const table = [
      { label: "negative", value: "-1", ok: false, msg: "invalid quantity" },
      { label: "zero", value: "0", ok: true },
      { label: "one", value: "1", ok: true },
      { label: "non-integer", value: "3.5", ok: false, msg: "invalid quantity" },
      { label: "large", value: "1000000", ok: true },
    ];

    test.each(table)(
      "quantity %s → server %s",
      async ({ value, ok, msg }) => {
        if (ok) {
          axios.put.mockResolvedValueOnce({ data: { success: true } });
        } else {
          axios.put.mockResolvedValueOnce({
            data: { success: false, message: msg },
          });
        }

        await fillWithCurrentValuesThen({ quantity: value });
        fireEvent.click(screen.getByRole("button", { name: /update product/i }));

        if (ok) {
          await waitFor(() => {
            expect(mockToast.success).toHaveBeenCalled();
            expect(mockNavigate).toHaveBeenCalled();
          });
        } else {
          await waitFor(() => {
            expect(mockToast.error).toHaveBeenCalledWith(msg);
          });
          expect(mockNavigate).not.toHaveBeenCalled();
        }
      }
    );
  });

  describe("Name/Description (EP/BVA)", () => {
    const longText = "x".repeat(500);
    const cases = [
      { name: "", desc: "ok", ok: false, msg: "name required" },
      { name: "A", desc: "ok", ok: true },
      { name: "Product", desc: "", ok: false, msg: "description required" },
      { name: "Product", desc: " ", ok: false, msg: "description required" },
      { name: "Product", desc: longText, ok: true },
    ];

    test.each(cases)(
      "name/desc partitions → server %s",
      async ({ name, desc, ok, msg }) => {
        if (ok) {
          axios.put.mockResolvedValueOnce({ data: { success: true } });
        } else {
          axios.put.mockResolvedValueOnce({
            data: { success: false, message: msg },
          });
        }

        await fillWithCurrentValuesThen({ name, description: desc });
        fireEvent.click(screen.getByRole("button", { name: /update product/i }));

        if (ok) {
          await waitFor(() => {
            expect(mockToast.success).toHaveBeenCalled();
            expect(mockNavigate).toHaveBeenCalled();
          });
        } else {
          await waitFor(() => {
            expect(mockToast.error).toHaveBeenCalledWith(msg);
          });
          expect(mockNavigate).not.toHaveBeenCalled();
        }
      }
    );
  });

  describe("Category/Shipping (EP)", () => {
    test("change shipping Yes→No updates FormData", async () => {
      axios.put.mockResolvedValueOnce({ data: { success: true } });
      const { appended, restore } = captureFormData();

      await fillWithCurrentValuesThen({ shippingLabel: "No" });
      fireEvent.click(screen.getByRole("button", { name: /update product/i }));

      await waitFor(() => expect(axios.put).toHaveBeenCalled());
      const asMap = Object.fromEntries(appended);
      // Value mapping depends on component; should be "0" for No
      expect(asMap.shipping).toBe("0");
      restore();
    });

    test("no category selected → server rejects", async () => {
      axios.put.mockResolvedValueOnce({
        data: { success: false, message: "category required" },
      });

      fireEvent.click(screen.getByRole("button", { name: /update product/i }));

      await waitFor(() =>
        expect(mockToast.error).toHaveBeenCalledWith("category required")
      );
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe("Photo (EP/BVA)", () => {
    test("no new file selected → still posts (server decides)", async () => {
      axios.put.mockResolvedValueOnce({ data: { success: true } });

      fireEvent.click(screen.getByRole("button", { name: /update product/i }));

      await waitFor(() => expect(mockToast.success).toHaveBeenCalled());
    });

    test("wrong MIME → server rejects with error", async () => {
      axios.put.mockResolvedValueOnce({
        data: { success: false, message: "invalid file type" },
      });

      const bad = new File(["plain"], "bad.txt", { type: "text/plain" });
      await fillWithCurrentValuesThen({ file: bad });

      fireEvent.click(screen.getByRole("button", { name: /update product/i }));

      await waitFor(() =>
        expect(mockToast.error).toHaveBeenCalledWith("invalid file type")
      );
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});

// -------------------- Destructive flow EP (delete prompt) --------------------
describe("UpdateProduct — delete prompt partitions", () => {
  test("prompt returns '' (empty string) → no API call", async () => {
    const promptSpy = jest.spyOn(window, "prompt").mockReturnValue("");
    render(<UpdateProduct />);
    await screen.findByRole("heading", { name: /update product/i });

    fireEvent.click(screen.getByRole("button", { name: /delete product/i }));

    expect(promptSpy).toHaveBeenCalled();
    expect(axios.delete).not.toHaveBeenCalled();
    promptSpy.mockRestore();
  });

  test("prompt returns null → no API call", async () => {
    const promptSpy = jest.spyOn(window, "prompt").mockReturnValue(null);
    render(<UpdateProduct />);
    await screen.findByRole("heading", { name: /update product/i });

    fireEvent.click(screen.getByRole("button", { name: /delete product/i }));

    expect(promptSpy).toHaveBeenCalled();
    expect(axios.delete).not.toHaveBeenCalled();
    promptSpy.mockRestore();
  });

  test("prompt returns any non-empty → calls API, success toast, navigate", async () => {
    const promptSpy = jest.spyOn(window, "prompt").mockReturnValue("yes");
    axios.delete.mockResolvedValueOnce({ data: { success: true } });

    render(<UpdateProduct />);
    await screen.findByDisplayValue("Widget");

    fireEvent.click(screen.getByRole("button", { name: /delete product/i }));

    await waitFor(() => {
      expect(axios.delete).toHaveBeenCalledWith(
        "/api/v1/product/delete-product/p1"
      );
      expect(mockToast.success).toHaveBeenCalledWith(
        "Product Deleted Successfully"
      );
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard/admin/products");
    });

    promptSpy.mockRestore();
  });
});

// -------------------- Explicit coverage for mount fetch + numeric onChange --------------------
describe("UpdateProduct — explicit coverage touches lines ~37 and ~100–101", () => {
  test("mount effect fetches product by slug", async () => {
    axios.get.mockReset();
    axios.get.mockImplementation((url) => {
      if (url.startsWith("/api/v1/product/get-product/")) {
        return Promise.resolve({ data: { product } });
      }
      if (url === "/api/v1/category/get-category") {
        return Promise.resolve({ data: { success: true, category: categories } });
      }
      return Promise.resolve({ data: {} });
    });

    render(<UpdateProduct />);
    await screen.findByRole("heading", { name: /update product/i });

    // Assert called with slug (robust to base path differences)
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/product\/get-product\/cool-product$/)
    );

    await screen.findByDisplayValue("Widget");
  });

  test("price & quantity onChange update state as strings before submit", async () => {
    axios.put.mockResolvedValueOnce({ data: { success: true } });

    render(<UpdateProduct />);
    await screen.findByDisplayValue("Widget");

    const priceInput = screen.getByPlaceholderText(/write a price/i);
    const qtyInput = screen.getByPlaceholderText(/write a quantity/i);

    // Drive onChange (BVA-ish: 0 and 1)
    fireEvent.change(priceInput, { target: { value: "0" } });
    fireEvent.change(qtyInput, { target: { value: "1" } });

    // In JSDOM, input.value is a string; assert as strings
    expect(priceInput.value).toBe("0");
    expect(qtyInput.value).toBe("1");

    fireEvent.click(screen.getByRole("button", { name: /update product/i }));
    await waitFor(() => expect(axios.put).toHaveBeenCalled());
  });

});
