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

// antd Select mock (exposes size/showSearch/value so we can assert lines 100–101 and value binding)
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
    const ariaLabel = rest["aria-label"] || placeholder;
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
          {React.Children.map(children, (child) => {
            if (!child) return null;
            const { value: v, children: label } = child.props || {};
            return (
              <button type="button" onClick={() => onChange?.(v)}>
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
      return Promise.resolve({
        data: { success: true, category: categories },
      });
    }
    return Promise.resolve({ data: {} });
  });
};

const clickOptionWithinSelect = (listbox, optionText) => {
  fireEvent.click(
    within(listbox.parentElement).getByRole("button", { name: optionText })
  );
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

beforeEach(() => {
  jest.clearAllMocks();
  wireAxiosHappy();
});

// -------------------- Tests --------------------

test("renders title, pre-fills product fields, and shows categories", async () => {
  render(<UpdateProduct />);

  const layout = await screen.findByTestId("layout");
  expect(layout).toHaveAttribute("data-title", "Dashboard - Update Product");
  expect(screen.getByTestId("admin-menu")).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.getByDisplayValue("Widget")).toBeInTheDocument();
    expect(screen.getByDisplayValue("A nice widget")).toBeInTheDocument();
    expect(screen.getByDisplayValue("42")).toBeInTheDocument();
    expect(screen.getByDisplayValue("10")).toBeInTheDocument();
  });

  const catBox = screen.getByRole("listbox", { name: /select a category/i });
  expect(
    within(catBox.parentElement).getByRole("button", { name: "Books" })
  ).toBeInTheDocument();
  expect(
    within(catBox.parentElement).getByRole("button", { name: "Games" })
  ).toBeInTheDocument();

  expect(
    screen.getByRole("listbox", { name: /select shipping/i })
  ).toBeInTheDocument();
});

test("category Select has size='large' and showSearch=true", async () => {
  render(<UpdateProduct />);
  const catBox = await screen.findByRole("listbox", {
    name: /select a category/i,
  });
  expect(catBox).toHaveAttribute("data-size", "large");
  expect(catBox).toHaveAttribute("data-showsearch", "true");
});

test("category onChange updates bound value ", async () => {
  render(<UpdateProduct />);

  // Wait for product to load so initial category ("c1") is set
  await screen.findByDisplayValue("Widget");

  const catBox = screen.getByRole("listbox", { name: /select a category/i });
  expect(catBox).toHaveAttribute("data-value", "c1");

  // Change to Games ("c2") to fire onChange and update bound value
  clickOptionWithinSelect(catBox, "Games");

  await waitFor(() => {
    expect(catBox).toHaveAttribute("data-value", "c2");
  });
});


// ✅ COVERS 189–198: both branches of photo conditional
test("photo branch toggles between server image and local preview (covers 189–198)", async () => {
  render(<UpdateProduct />);
  await screen.findByDisplayValue("Widget");

  // else-branch initially: server image (no local photo)
  let img = screen.getByAltText("product_photo");
  expect(img.getAttribute("src")).toBe("/api/v1/product/product-photo/p1");

  // truthy branch: select a local file, preview uses createObjectURL
  const fileInput = document.querySelector('input[name="photo"]');
  const file = new File(["x"], "pic.png", { type: "image/png" });
  fireEvent.change(fileInput, { target: { files: [file] } });

  img = await screen.findByAltText("product_photo");
  expect(img.getAttribute("src")).toBe("blob:preview");

  // back to else-branch by clearing the file (sets photo to undefined)
  fireEvent.change(fileInput, { target: { files: [] } });

  await waitFor(() => {
    const imgBack = screen.getByAltText("product_photo");
    expect(imgBack.getAttribute("src")).toBe(
      "/api/v1/product/product-photo/p1"
    );
  });
});

test("update success: sends FormData, toasts, and navigates", async () => {
  axios.put.mockResolvedValueOnce({ data: { success: true } });
  const { appended, restore } = captureFormData();

  render(<UpdateProduct />);
  await screen.findByText("Update Product");

  fireEvent.change(screen.getByPlaceholderText(/write a name/i), {
    target: { value: "Widget v2" },
  });
  fireEvent.change(screen.getByPlaceholderText(/write a description/i), {
    target: { value: "Even nicer" },
  });

  const catBox = screen.getByRole("listbox", { name: /select a category/i });
  clickOptionWithinSelect(catBox, "Games");

  const fileInput = document.querySelector('input[name="photo"]');
  const file = new File(["x"], "upd.png", { type: "image/png" });
  fireEvent.change(fileInput, { target: { files: [file] } });

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
  expect(asMap.shipping).toBe("1");
  expect(asMap.photo).toBe(file);

  restore();
});

test("update failure (success:false) shows toast.error and does not navigate", async () => {
  axios.put.mockResolvedValueOnce({
    data: { success: false, message: "invalid fields" },
  });

  render(<UpdateProduct />);
  await screen.findByText("Update Product");

  fireEvent.click(screen.getByRole("button", { name: /update product/i }));

  await waitFor(() => {
    expect(mockToast.error).toHaveBeenCalledWith("invalid fields");
  });
  expect(mockNavigate).not.toHaveBeenCalled();
});

test("update catch shows 'something went wrong' toast", async () => {
  axios.put.mockRejectedValueOnce(new Error("network down"));

  render(<UpdateProduct />);
  await screen.findByText("Update Product");

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
    expect(within(catBox.parentElement).queryAllByRole("button").length).toBe(0);
    expect(mockToast.error).not.toHaveBeenCalled();
  });
});

test("getAllCategory catch toasts 'Something went wrong in getting category'", async () => {
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

test("getSingleProduct catch logs error (no toast)", async () => {
  const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  axios.get.mockReset();
  axios.get.mockImplementation((url) => {
    if (url.startsWith("/api/v1/product/get-product/")) {
      return Promise.reject(new Error("fetch fail"));
    }
    if (url === "/api/v1/category/get-category") {
      return Promise.resolve({ data: { success: true, category: categories } });
    }
    return Promise.resolve({ data: {} });
  });

  render(<UpdateProduct />);

  await waitFor(() => {
    expect(logSpy).toHaveBeenCalled();
  });
  expect(mockToast.error).not.toHaveBeenCalled();
  logSpy.mockRestore();
});

test("shipping select change updates FormData (from Yes to No)", async () => {
  axios.put.mockResolvedValueOnce({ data: { success: true } });
  const { appended, restore } = captureFormData();

  render(<UpdateProduct />);
  await screen.findByText("Update Product");

  const shipBox = screen.getByRole("listbox", { name: /select shipping/i });
  clickOptionWithinSelect(shipBox, "No");

  fireEvent.click(screen.getByRole("button", { name: /update product/i }));

  await waitFor(() => expect(axios.put).toHaveBeenCalled());
  const asMap = Object.fromEntries(appended);
  expect(asMap.shipping).toBe("0");

  restore();
});

test("delete cancel: prompt falsy => no API call", async () => {
  const promptSpy = jest.spyOn(window, "prompt").mockReturnValue("");
  render(<UpdateProduct />);
  await screen.findByText("Update Product");

  fireEvent.click(screen.getByRole("button", { name: /delete product/i }));

  expect(promptSpy).toHaveBeenCalled();
  expect(axios.delete).not.toHaveBeenCalled();

  promptSpy.mockRestore();
});

test("delete confirm: calls API, shows success toast, navigates", async () => {
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

test("server product-photo URL is used when no local photo chosen", async () => {
  render(<UpdateProduct />);
  await screen.findByDisplayValue("Widget");

  const img = screen.getByAltText("product_photo");
  expect(img.getAttribute("src")).toBe("/api/v1/product/product-photo/p1");
});
