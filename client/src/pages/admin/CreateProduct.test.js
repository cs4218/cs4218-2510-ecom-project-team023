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

// Mock Layout
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

// Mock antd Select + Option
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

// Mock toast
const mockToast = { success: jest.fn(), error: jest.fn() };
jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    success: (m) => mockToast.success(m),
    error: (m) => mockToast.error(m),
  },
}));

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  __esModule: true,
  useNavigate: () => mockNavigate,
}));

beforeAll(() => {
  global.URL.createObjectURL = jest.fn(() => "blob:preview");
});

const CreateProduct = require("./CreateProduct").default;

// ----- helpers -----
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

// async helper: wait for option button to exist, then click
const clickOptionWithinSelect = async (listbox, optionText) => {
  const btn = await within(listbox.parentElement).findByRole("button", {
    name: optionText,
  });
  fireEvent.click(btn);
};

// capture FormData appends
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

// ----- tests -----

test("renders Layout title, AdminMenu, and loads categories", async () => {
  render(<CreateProduct />);

  const layout = await screen.findByTestId("layout");
  expect(layout).toHaveAttribute("data-title", "Dashboard - Create Product");
  expect(screen.getByTestId("admin-menu")).toBeInTheDocument();

  const catBox = await screen.findByRole("listbox", {
    name: /select a category/i,
  });

  // wait for options to appear (important!)
  expect(
    await within(catBox.parentElement).findByRole("button", { name: "Books" })
  ).toBeInTheDocument();
  expect(
    await within(catBox.parentElement).findByRole("button", { name: "Games" })
  ).toBeInTheDocument();
});

test("shows photo preview when a file is selected", async () => {
  render(<CreateProduct />);
  const fileInput = document.querySelector('input[name="photo"]');
  const file = new File(["x"], "pic.png", { type: "image/png" });

  fireEvent.change(fileInput, { target: { files: [file] } });

  expect(await screen.findByAltText("product_photo")).toBeInTheDocument();
});

test("create (success) submits FormData, toasts success, and navigates", async () => {
  axios.post.mockResolvedValueOnce({ data: { success: true } });

  const { appended, restore } = captureFormData();

  render(<CreateProduct />);
  await screen.findByText("Create Product");

  const catListbox = screen.getByRole("listbox", { name: /select a category/i });
  await clickOptionWithinSelect(catListbox, "Books");

  const shipListbox = screen.getByRole("listbox", { name: /select shipping/i });
  await clickOptionWithinSelect(shipListbox, "Yes");

  fireEvent.change(screen.getByPlaceholderText(/write a name/i), {
    target: { value: "New Product" },
  });
  fireEvent.change(screen.getByPlaceholderText(/write a description/i), {
    target: { value: "Lovely thing" },
  });
  fireEvent.change(screen.getByPlaceholderText(/write a price/i), {
    target: { value: "99" },
  });
  fireEvent.change(screen.getByPlaceholderText(/write a quantity/i), {
    target: { value: "5" },
  });

  const fileInput = document.querySelector('input[name="photo"]');
  const file = new File(["x"], "pic.png", { type: "image/png" });
  fireEvent.change(fileInput, { target: { files: [file] } });

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
  expect(map.category).toBe("c1");
  expect(map.photo).toBe(file);

  restore();
});

test("create (failure, success:false) shows toast.error and does not navigate", async () => {
  axios.post.mockResolvedValueOnce({
    data: { success: false, message: "invalid payload" },
  });

  render(<CreateProduct />);
  await screen.findByText("Create Product");

  const catListbox = screen.getByRole("listbox", { name: /select a category/i });
  await clickOptionWithinSelect(catListbox, "Books");

  fireEvent.change(screen.getByPlaceholderText(/write a name/i), {
    target: { value: "Bad Product" },
  });

  fireEvent.click(screen.getByRole("button", { name: /create product/i }));

  await waitFor(() => {
    expect(mockToast.error).toHaveBeenCalledWith("invalid payload");
  });
  expect(mockNavigate).not.toHaveBeenCalled();
});

test("create (catch) shows 'something went wrong' toast", async () => {
  axios.post.mockRejectedValueOnce(new Error("network down"));

  render(<CreateProduct />);
  await screen.findByText("Create Product");

  const catListbox = screen.getByRole("listbox", { name: /select a category/i });
  await clickOptionWithinSelect(catListbox, "Books");
  fireEvent.change(screen.getByPlaceholderText(/write a name/i), {
    target: { value: "X" },
  });

  fireEvent.click(screen.getByRole("button", { name: /create product/i }));

  await waitFor(() => {
    expect(axios.post).toHaveBeenCalled();
    expect(mockToast.error).toHaveBeenCalledWith("something went wrong");
  });
});

test("getAllCategory catch shows correctly spelled toast", async () => {
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

test("getAllCategory: success=false does not populate categories", async () => {
  // Force the fetch to resolve with success=false
  axios.get.mockReset();
  axios.get.mockImplementation((url) => {
    if (url === "/api/v1/category/get-category") {
      return Promise.resolve({ data: { success: false, message: "no list" } });
    }
    return Promise.resolve({ data: {} });
  });

  render(<CreateProduct />);

  // The Select should render, but with no option buttons since categories weren't set
  const catBox = await screen.findByRole("listbox", { name: /select a category/i });

  await waitFor(() => {
    const optionButtons = within(catBox.parentElement).queryAllByRole("button");
    expect(optionButtons.length).toBe(0);
    // No toast here because only the catch branch toasts the error
    expect(mockToast.error).not.toHaveBeenCalled();
  });
});
