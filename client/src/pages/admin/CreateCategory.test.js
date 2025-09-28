// client/src/pages/admin/CreateCategory.test.js
import React from "react";
import axios from "axios";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";

// ----------------- Mocks (MUST come before requiring SUT) -----------------
jest.mock("axios");

// Layout (capture title)
jest.mock("../../components/Layout", () => {
  const React = require("react");
  const LayoutMock = ({ children, title }) => (
    <div data-testid="layout" data-title={title}>
      {children}
    </div>
  );
  return { __esModule: true, default: LayoutMock };
});

// AdminMenu
jest.mock("../../components/AdminMenu", () => {
  const React = require("react");
  const AdminMenu = () => <nav data-testid="admin-menu" />;
  return { __esModule: true, default: AdminMenu };
});

// CategoryForm (shared by top form + modal)
jest.mock("../../components/Form/CategoryForm", () => {
  const React = require("react");
  const CategoryForm = ({ value, setValue, handleSubmit }) => (
    <form onSubmit={(e) => { e.preventDefault(); handleSubmit(e); }}>
      <input
        aria-label="category-name"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button type="submit">Submit</button>
    </form>
  );
  return { __esModule: true, default: CategoryForm };
});

// antd Modal (prop `visible` like in your component)
jest.mock("antd", () => ({
  __esModule: true,
  Modal: ({ visible, onCancel, children }) =>
    visible ? (
      <div data-testid="modal">
        <button onClick={onCancel}>Close</button>
        {children}
      </div>
    ) : null,
}));

// toast
const mockToast = { success: jest.fn(), error: jest.fn() };
jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    success: (msg) => mockToast.success(msg),
    error: (msg) => mockToast.error(msg),
  },
}));

// ----------------- REQUIRE SUT AFTER MOCKS -----------------
const CreateCategory = require("./CreateCategory").default;

// ----------------- Helpers -----------------
const categories = [
  { _id: "c1", name: "Books" },
  { _id: "c2", name: "Games" },
];

const wireInitialAxiosSuccess = () => {
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
  wireInitialAxiosSuccess();
});

// ----------------- Tests -----------------

test("renders Layout title, AdminMenu, and initial category list", async () => {
  render(<CreateCategory />);

  const layout = await screen.findByTestId("layout");
  expect(layout).toHaveAttribute("data-title", "Dashboard - Create Category");

  expect(await screen.findByText("Books")).toBeInTheDocument();
  expect(screen.getByText("Games")).toBeInTheDocument();
  expect(screen.getByTestId("admin-menu")).toBeInTheDocument();
});

/** 21–23: handleSubmit success -> toast + refresh */
test("create category: success branch toasts and refreshes list (covers 21–23)", async () => {
  axios.post.mockResolvedValueOnce({ data: { success: true } });

  render(<CreateCategory />);
  await screen.findByText("Books");

  const input = screen.getByLabelText("category-name");
  fireEvent.change(input, { target: { value: "NewCat" } });
  fireEvent.click(screen.getByText("Submit")); // top form

  await waitFor(() => {
    expect(axios.post).toHaveBeenCalledWith(
      "/api/v1/category/create-category",
      { name: "NewCat" }
    );
    expect(mockToast.success).toHaveBeenCalledWith("NewCat is created");
  });
  expect(axios.get).toHaveBeenCalledWith("/api/v1/category/get-category");
});

/** 24–25: handleSubmit success=false -> toast.error(message) */
test("create category: success === false triggers toast.error with message (covers 24–25)", async () => {
  axios.post.mockResolvedValueOnce({
    data: { success: false, message: "name required" },
  });

  render(<CreateCategory />);
  await screen.findByText("Books");

  const input = screen.getByLabelText("category-name");
  fireEvent.change(input, { target: { value: "X" } });
  fireEvent.click(screen.getByText("Submit"));

  await waitFor(() => {
    expect(mockToast.error).toHaveBeenCalledWith("name required");
  });
});

/** 28–29: handleSubmit catch -> console.log + toast.error("somthing went wrong in input form") */
test("handleSubmit catch: logs & toasts 'Something went wrong in input form' (covers 28–29)", async () => {
  const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  axios.post.mockRejectedValueOnce(new Error("network error"));

  render(<CreateCategory />);
  await screen.findByText("Books");

  const input = screen.getByLabelText("category-name");
  fireEvent.change(input, { target: { value: "Oops" } });
  fireEvent.click(screen.getByText("Submit"));

  await waitFor(() => {
    expect(mockToast.error).toHaveBeenCalledWith(
      "Something went wrong in input form"
    );
    expect(logSpy).toHaveBeenCalled();
  });
  logSpy.mockRestore();
});

/** 65–68: getAllCategory catch -> console.log + toast.error("Something went wrong in getting catgeory") */
test("getAllCategory catch logs and toasts (covers 65–68)", async () => {
  axios.get.mockReset();
  axios.get.mockImplementation((url) => {
    if (url === "/api/v1/category/get-category") {
      return Promise.reject(new Error("boom"));
    }
    return Promise.resolve({ data: {} });
  });

  const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  render(<CreateCategory />);

  await waitFor(() => {
    expect(mockToast.error).toHaveBeenCalledWith(
      "Something went wrong in getting catgeory"
    );
    expect(logSpy).toHaveBeenCalled();
  });
  logSpy.mockRestore();
});

/** 73–85: Edit click sets visible, pre-fills updatedName, selected; update success path */
test("Edit shows modal, pre-fills name, and update uses selected._id (covers 73–85)", async () => {
  axios.put.mockResolvedValueOnce({ data: { success: true } });

  render(<CreateCategory />);
  await screen.findByText("Books");

  const editBtns = screen.getAllByText("Edit");
  fireEvent.click(editBtns[0]); // open for Books

  const modal = await screen.findByTestId("modal");
  const modalInput = within(modal).getByLabelText("category-name");
  expect(modalInput).toHaveValue("Books"); // setUpdatedName(c.name)

  fireEvent.change(modalInput, { target: { value: "Books++" } });
  fireEvent.click(within(modal).getByText("Submit")); // modal submit

  await waitFor(() => {
    expect(axios.put).toHaveBeenCalledWith(
      "/api/v1/category/update-category/c1",
      { name: "Books++" }
    );
    expect(mockToast.success).toHaveBeenCalledWith("Books++ is updated");
    // setVisible(false): modal closes
    expect(screen.queryByTestId("modal")).toBeNull();
  });
  // refresh ran
  expect(axios.get).toHaveBeenCalledWith("/api/v1/category/get-category");
});

/** Update: success=false branch -> toast.error(data.message), modal stays open */
test("Edit update: success=false keeps modal open and shows toast.error", async () => {
  axios.put.mockResolvedValueOnce({ data: { success: false, message: "nope" } });

  render(<CreateCategory />);
  await screen.findByText("Books");

  fireEvent.click(screen.getAllByText("Edit")[0]);
  const modal = await screen.findByTestId("modal");

  fireEvent.click(within(modal).getByText("Submit"));

  await waitFor(() => {
    expect(mockToast.error).toHaveBeenCalledWith("nope");
    expect(screen.getByTestId("modal")).toBeInTheDocument(); // still visible
  });
});

/** Update: catch branch -> toast.error("Something went wrong") */
test("Edit update: catch path toasts 'Sometihing went wrong'", async () => {
  axios.put.mockRejectedValueOnce(new Error("update failed"));

  render(<CreateCategory />);
  await screen.findByText("Books");

  fireEvent.click(screen.getAllByText("Edit")[0]);
  const modal = await screen.findByTestId("modal");
  fireEvent.click(within(modal).getByText("Submit"));

  await waitFor(() => {
    expect(mockToast.error).toHaveBeenCalledWith("Something went wrong");
    expect(screen.getByTestId("modal")).toBeInTheDocument();
  });
});

/** 131–144: Modal onCancel hides modal (setVisible(false)) */
test("modal Close button calls onCancel and hides modal (covers 131–144)", async () => {
  render(<CreateCategory />);
  await screen.findByText("Books");

  fireEvent.click(screen.getAllByText("Edit")[0]);
  const modal = await screen.findByTestId("modal");

  fireEvent.click(within(modal).getByText("Close"));
  await waitFor(() => {
    expect(screen.queryByTestId("modal")).toBeNull();
  });
});

/** Delete: success path -> toast + refresh */
test("delete: success toasts and refreshes list", async () => {
  axios.delete.mockResolvedValueOnce({ data: { success: true } });

  render(<CreateCategory />);
  await screen.findByText("Books");

  fireEvent.click(screen.getAllByText("Delete")[0]);
  await waitFor(() => {
    expect(axios.delete).toHaveBeenCalledWith(
      "/api/v1/category/delete-category/c1"
    );
    expect(mockToast.success).toHaveBeenCalledWith("category is deleted");
  });
  expect(axios.get).toHaveBeenCalledWith("/api/v1/category/get-category");
});

/** Delete: success=false branch -> toast.error(data.message), no refresh */
test("delete: success=false shows toast.error and does not refresh", async () => {
  axios.delete.mockResolvedValueOnce({
    data: { success: false, message: "cannot" },
  });

  render(<CreateCategory />);
  await screen.findByText("Books");

  fireEvent.click(screen.getAllByText("Delete")[0]);
  await waitFor(() => {
    expect(mockToast.error).toHaveBeenCalledWith("cannot");
  });

  // No extra refresh call beyond initial mount (which was already called in beforeEach)
  const refreshCalls = axios.get.mock.calls.filter(
    (c) => c[0] === "/api/v1/category/get-category"
  ).length;
  expect(refreshCalls).toBe(1);
});

/** Delete: catch branch -> toast.error("Something went wrong") */
test("delete: catch path toasts 'Something went wrong'", async () => {
  axios.delete.mockRejectedValueOnce(new Error("delete failed"));

  render(<CreateCategory />);
  await screen.findByText("Books");

  fireEvent.click(screen.getAllByText("Delete")[0]);
  await waitFor(() => {
    expect(mockToast.error).toHaveBeenCalledWith("Something went wrong");
  });
});
// getAllCategory: success=false should NOT set categories 
test("getAllCategory success=false does not populate categories (covers line 37 false)", async () => {
  // override the default success wiring
  axios.get.mockReset();
  axios.get.mockImplementation((url) => {
    if (url === "/api/v1/category/get-category") {
      // success=false -> should skip setCategories
      return Promise.resolve({
        data: { success: false, category: [{ _id: "cX", name: "ShouldNotRender" }] },
      });
    }
    return Promise.resolve({ data: {} });
  });

  render(<CreateCategory />);

  // allow effect to run; no category rows should render
  await waitFor(() => {
    expect(screen.queryByText("ShouldNotRender")).toBeNull();
  });

  // and this isn't the catch path, so no error toast expected
  expect(mockToast.error).not.toHaveBeenCalled();

  // verify the fetch happened
  expect(axios.get).toHaveBeenCalledWith("/api/v1/category/get-category");
});
