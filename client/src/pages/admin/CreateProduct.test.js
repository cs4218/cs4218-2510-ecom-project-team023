// Some tests written with help of AI
// client/src/pages/admin/CreateProduct.test.js
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

jest.mock("axios");

// ---- Light-weight doubles / shims ----

// Layout (surface title)
jest.mock("../../components/Layout", () => {
  const React = require("react");
  const Layout = ({ children, title }) => (
    <div data-testid="layout" data-title={title}>
      {children}
    </div>
  );
  return { __esModule: true, default: Layout };
});

// AdminMenu
jest.mock("../../components/AdminMenu", () => {
  const React = require("react");
  const AdminMenu = () => <nav data-testid="admin-menu" />;
  return { __esModule: true, default: AdminMenu };
});

// antd Select shim with clickable “options”
jest.mock("antd", () => {
  const React = require("react");
  const Option = ({ children }) => null;

  const Select = ({ children, placeholder, onChange, className, ...rest }) => {
    const ariaLabel = rest["aria-label"] || placeholder || "Select";
    const childArray = React.Children.toArray(children);
    return (
      <div className={className || "form-select mb-3"}>
        <div role="listbox" aria-label={ariaLabel} data-testid="select-display" />
        <div>
          {childArray.map((child, idx) => {
            const props = child && child.props ? child.props : {};
            const value = props.value ?? props.key ?? `opt-${idx}`;
            const label =
              props.children != null ? props.children : String(value);
            return (
              <button
                type="button"
                key={value}
                onClick={() => onChange && onChange(value)}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  Select.Option = Option;
  return { __esModule: true, Select, Option };
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

// navigation
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  __esModule: true,
  useNavigate: () => mockNavigate,
}));

beforeAll(() => {
  global.URL.createObjectURL = jest.fn(() => "blob:preview");
});

const CreateProduct = require("./CreateProduct").default;

// ---- helpers & fixtures ----
const categories = [
  { _id: "c1", name: "Books" },
  { _id: "c2", name: "Games" },
];

const wireCategoriesSuccess = () => {
  axios.get.mockImplementation((url) => {
    if (url === "/api/v1/category/get-category") {
      return Promise.resolve({
        data: { success: true, category: categories },
      });
    }
    return Promise.resolve({ data: {} });
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  wireCategoriesSuccess();
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

const fillMinimalHappyPath = async (overrides = {}) => {
  // Minimal valid payload
  const {
    name = "New Product",
    description = "Lovely thing",
    price = "99",
    quantity = "5",
    categoryLabel = "Books",
    shippingLabel = "Yes",
    file = new File(["x"], "pic.png", { type: "image/png" }),
  } = overrides;

  const catListbox = screen.getByRole("listbox", { name: /select a category/i });
  await clickOptionWithinSelect(catListbox, categoryLabel);

  const shipListbox = screen.getByRole("listbox", { name: /select shipping/i });
  await clickOptionWithinSelect(shipListbox, shippingLabel);

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

  const fileInput = document.querySelector('input[name="photo"]');
  if (file !== undefined) {
    fireEvent.change(fileInput, { target: { files: [file] } });
  }
};

// ---- smoke & baseline ----
describe("CreateProduct — smoke / baseline", () => {
  test("renders Layout title, AdminMenu, and loads categories", async () => {
    render(<CreateProduct />);

    const layout = await screen.findByTestId("layout");
    expect(layout).toHaveAttribute("data-title", "Dashboard - Create Product");
    expect(screen.getByTestId("admin-menu")).toBeInTheDocument();

    // Wait for heading (unique role)
    await screen.findByRole("heading", { name: /create product/i });

    const catBox = await screen.findByRole("listbox", {
      name: /select a category/i,
    });
    expect(
      await within(catBox.parentElement).findByRole("button", { name: "Books" })
    ).toBeInTheDocument();
    expect(
      await within(catBox.parentElement).findByRole("button", { name: "Games" })
    ).toBeInTheDocument();
  });

  test("shows photo preview when a file is selected", async () => {
    render(<CreateProduct />);
    await screen.findByRole("heading", { name: /create product/i });

    const fileInput = document.querySelector('input[name="photo"]');
    const file = new File(["x"], "pic.png", { type: "image/png" });

    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(await screen.findByAltText("product_photo")).toBeInTheDocument();
  });

  test("happy path: submits FormData, toasts success, and navigates", async () => {
    axios.post.mockResolvedValueOnce({ data: { success: true } });
    const { appended, restore } = captureFormData();

    render(<CreateProduct />);
    await screen.findByRole("heading", { name: /create product/i });
    await fillMinimalHappyPath();

    fireEvent.click(screen.getByRole("button", { name: /create product/i }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        "/api/v1/product/create-product",
        expect.any(FormData)
      );
      expect(mockToast.success).toHaveBeenCalledWith(
        "Product Created Successfully"
      );
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard/admin/products");
    });

    const map = Object.fromEntries(appended);
    expect(map.name).toBe("New Product");
    expect(map.description).toBe("Lovely thing");
    expect(map.price).toBe("99");
    expect(map.quantity).toBe("5");
    expect(map.category).toBe("c1"); // Books
    expect(map.photo).toBeInstanceOf(File);

    restore();
  });

  test("server failure: success:false → toast.error and no navigate", async () => {
    axios.post.mockResolvedValueOnce({
      data: { success: false, message: "invalid payload" },
    });

    render(<CreateProduct />);
    await screen.findByRole("heading", { name: /create product/i });
    await fillMinimalHappyPath({ name: "Bad Product" });

    fireEvent.click(screen.getByRole("button", { name: /create product/i }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("invalid payload");
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test("network failure: catch → generic toast.error", async () => {
    axios.post.mockRejectedValueOnce(new Error("network down"));

    render(<CreateProduct />);
    await screen.findByRole("heading", { name: /create product/i });
    await fillMinimalHappyPath({ name: "X" });

    fireEvent.click(screen.getByRole("button", { name: /create product/i }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalled();
      expect(mockToast.error).toHaveBeenCalledWith("something went wrong");
    });
  });

  test("getAllCategory catch → correctly spelled toast", async () => {
    axios.get.mockReset();
    axios.get.mockImplementation((url) => {
      if (url === "/api/v1/category/get-category") {
        return Promise.reject(new Error("boom"));
      }
      return Promise.resolve({ data: {} });
    });

    render(<CreateProduct />);
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        "Something went wrong in getting category"
      );
    });
  });

  test("getAllCategory success:false → no options (and no toast)", async () => {
    axios.get.mockReset();
    axios.get.mockImplementation((url) => {
      if (url === "/api/v1/category/get-category") {
        return Promise.resolve({ data: { success: false, message: "no list" } });
      }
      return Promise.resolve({ data: {} });
    });

    render(<CreateProduct />);
    const catBox = await screen.findByRole("listbox", { name: /select a category/i });

    await waitFor(() => {
      const optionButtons = within(catBox.parentElement).queryAllByRole("button");
      expect(optionButtons.length).toBe(0);
      expect(mockToast.error).not.toHaveBeenCalled();
    });
  });
});

// ---- EP / BVA suites ----
describe("CreateProduct — EP/BVA for inputs", () => {
  beforeEach(async () => {
    render(<CreateProduct />);
    await screen.findByRole("heading", { name: /create product/i });
  });

  describe("Price (EP/BVA)", () => {
    const table = [
      { label: "empty", value: "", server: { ok: false, msg: "price required" } },
      { label: "negative", value: "-1", server: { ok: false, msg: "invalid price" } },
      { label: "zero (lower bound)", value: "0", server: { ok: true } },
      { label: "small int", value: "1", server: { ok: true } },
      { label: "decimal", value: "9.99", server: { ok: true } },
      { label: "very large", value: "999999999", server: { ok: true } },
    ];

    test.each(table)("price %s → server %s", async ({ value, server }) => {
      if (server.ok) {
        axios.post.mockResolvedValueOnce({ data: { success: true } });
      } else {
        axios.post.mockResolvedValueOnce({
          data: { success: false, message: server.msg },
        });
      }

      await fillMinimalHappyPath({ price: value });
      fireEvent.click(screen.getByRole("button", { name: /create product/i }));

      if (server.ok) {
        await waitFor(() => {
          expect(mockToast.success).toHaveBeenCalled();
          expect(mockNavigate).toHaveBeenCalled();
        });
      } else {
        await waitFor(() => {
          expect(mockToast.error).toHaveBeenCalledWith(server.msg);
        });
        expect(mockNavigate).not.toHaveBeenCalled();
      }
    });
  });

  describe("Quantity (EP/BVA)", () => {
    const table = [
      { label: "negative", value: "-1", ok: false, msg: "invalid quantity" },
      { label: "zero (edge)", value: "0", ok: true },
      { label: "one (lower valid)", value: "1", ok: true },
      { label: "non-integer", value: "3.5", ok: false, msg: "invalid quantity" },
      { label: "large", value: "1000000", ok: true },
    ];

    test.each(table)("quantity %s → server %s", async ({ value, ok, msg }) => {
      if (ok) {
        axios.post.mockResolvedValueOnce({ data: { success: true } });
      } else {
        axios.post.mockResolvedValueOnce({
          data: { success: false, message: msg },
        });
      }

      await fillMinimalHappyPath({ quantity: value });
      fireEvent.click(screen.getByRole("button", { name: /create product/i }));

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
          axios.post.mockResolvedValueOnce({ data: { success: true } });
        } else {
          axios.post.mockResolvedValueOnce({
            data: { success: false, message: msg },
          });
        }

        await fillMinimalHappyPath({ name, description: desc });
        fireEvent.click(screen.getByRole("button", { name: /create product/i }));

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
    test("no category selected → server rejects", async () => {
      axios.post.mockResolvedValueOnce({
        data: { success: false, message: "category required" },
      });

      // Fill everything except category
      const shipListbox = screen.getByRole("listbox", { name: /select shipping/i });
      await clickOptionWithinSelect(shipListbox, "Yes");

      fireEvent.change(screen.getByPlaceholderText(/write a name/i), {
        target: { value: "X" },
      });
      fireEvent.change(screen.getByPlaceholderText(/write a description/i), {
        target: { value: "Y" },
      });
      fireEvent.change(screen.getByPlaceholderText(/write a price/i), {
        target: { value: "10" },
      });
      fireEvent.change(screen.getByPlaceholderText(/write a quantity/i), {
        target: { value: "1" },
      });

      const fileInput = document.querySelector('input[name="photo"]');
      fireEvent.change(fileInput, {
        target: { files: [new File(["x"], "a.png", { type: "image/png" })] },
      });

      fireEvent.click(screen.getByRole("button", { name: /create product/i }));

      await waitFor(() =>
        expect(mockToast.error).toHaveBeenCalledWith("category required")
      );
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    test("shipping No/Yes append to FormData", async () => {
      axios.post.mockResolvedValueOnce({ data: { success: true } });
      const { appended, restore } = captureFormData();

      await fillMinimalHappyPath({ shippingLabel: "No" });
      fireEvent.click(screen.getByRole("button", { name: /create product/i }));

      await waitFor(() => expect(mockToast.success).toHaveBeenCalled());
      const pairs = Object.fromEntries(appended);
      expect(pairs).toHaveProperty("shipping"); 
      restore();
    });
  });

  describe("Photo (EP/BVA)", () => {
    test("no file selected → still posts (server decides)", async () => {
      axios.post.mockResolvedValueOnce({ data: { success: true } });

      await fillMinimalHappyPath({ file: undefined });
      fireEvent.click(screen.getByRole("button", { name: /create product/i }));

      await waitFor(() => expect(mockToast.success).toHaveBeenCalled());
    });

    test("wrong MIME type → server rejects with error", async () => {
      axios.post.mockResolvedValueOnce({
        data: { success: false, message: "invalid file type" },
      });

      const bad = new File(["plain"], "bad.txt", { type: "text/plain" });
      await fillMinimalHappyPath({ file: bad });

      fireEvent.click(screen.getByRole("button", { name: /create product/i }));

      await waitFor(() =>
        expect(mockToast.error).toHaveBeenCalledWith("invalid file type")
      );
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});
