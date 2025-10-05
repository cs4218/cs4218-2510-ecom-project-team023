import React from "react";
import { render, fireEvent, waitFor, screen } from "@testing-library/react";
import axios from "axios";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import "@testing-library/jest-dom/extend-expect";
import toast from "react-hot-toast";
import Login from "./Login";

// ---- Mock setup ----
jest.mock("axios");
jest.mock("react-hot-toast");

// mock hooks
const mockSetAuth = jest.fn();
jest.mock("../../context/auth", () => ({
  useAuth: jest.fn(() => [null, mockSetAuth]),
}));

jest.mock("../../context/cart", () => ({
  useCart: jest.fn(() => [null, jest.fn()]),
}));

jest.mock("../../context/search", () => ({
  useSearch: jest.fn(() => [{ keyword: "" }, jest.fn()]),
}));

jest.mock("../../hooks/useCategory", () => jest.fn(() => []));

// mock localStorage
Object.defineProperty(window, "localStorage", {
  value: {
    setItem: jest.fn(),
    getItem: jest.fn(),
    removeItem: jest.fn(),
  },
  writable: true,
});

// mock matchMedia for responsive components
window.matchMedia =
  window.matchMedia ||
  function () {
    return {
      matches: false,
      addListener: jest.fn(),
      removeListener: jest.fn(),
    };
  };

// ---- Tests ----
describe("Login Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const setup = () =>
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/forgot-password"
            element={<div>Forgot Password Page</div>}
          />
          <Route path="/" element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>
    );

  test("should render login form correctly", () => {
    setup();
    expect(screen.getByText("LOGIN FORM")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter Your Email")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Enter Your Password")
    ).toBeInTheDocument();
  });

  test("inputs should be initially empty", () => {
    setup();
    expect(screen.getByPlaceholderText("Enter Your Email").value).toBe("");
    expect(screen.getByPlaceholderText("Enter Your Password").value).toBe("");
  });

  test("should allow typing into email and password inputs", () => {
    setup();
    const emailInput = screen.getByPlaceholderText("Enter Your Email");
    const passwordInput = screen.getByPlaceholderText("Enter Your Password");

    fireEvent.change(emailInput, { target: { value: "user@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "mypassword" } });

    expect(emailInput.value).toBe("user@example.com");
    expect(passwordInput.value).toBe("mypassword");
  });

  test("should navigate to forgot password page when button is clicked", () => {
    setup();
    fireEvent.click(screen.getByText("Forgot Password"));
    expect(screen.getByText("Forgot Password Page")).toBeInTheDocument();
  });

  test("should login successfully and redirect to home", async () => {
    axios.post.mockResolvedValueOnce({
      data: {
        success: true,
        message: "login successfully",
        user: {
          _id: "123",
          name: "Alice",
          email: "alice@example.com",
        },
        token: "mockToken",
      },
    });

    setup();
    fireEvent.change(screen.getByPlaceholderText("Enter Your Email"), {
      target: { value: "alice@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Password"), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByText("LOGIN"));

    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));

    expect(toast.success).toHaveBeenCalledWith("login successfully", {
      duration: 5000,
      icon: "🙏",
      style: { background: "green", color: "white" },
    });
    expect(mockSetAuth).toHaveBeenCalledWith({
      user: {
        _id: "123",
        name: "Alice",
        email: "alice@example.com",
      },
      token: "mockToken",
    });
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "auth",
      JSON.stringify({
        success: true,
        message: "login successfully",
        user: {
          _id: "123",
          name: "Alice",
          email: "alice@example.com",
        },
        token: "mockToken",
      })
    );
  });

  test("should show toast error when axios throws a 404 invalid password error", async () => {
    axios.post.mockRejectedValueOnce({
      response: {
        data: { message: "Invalid Password" },
        status: 404,
      },
    });

    setup();
    fireEvent.change(screen.getByPlaceholderText("Enter Your Email"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Password"), {
      target: { value: "wrongpassword" },
    });
    fireEvent.click(screen.getByText("LOGIN"));

    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));

    expect(toast.error).toHaveBeenCalledWith("Invalid Password");
  });

  test("should handle backend 500 error gracefully", async () => {
    axios.post.mockRejectedValueOnce({
      response: {
        data: { message: "Internal server error" },
        status: 500,
      },
    });

    setup();
    fireEvent.change(screen.getByPlaceholderText("Enter Your Email"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Password"), {
      target: { value: "password" },
    });
    fireEvent.click(screen.getByText("LOGIN"));

    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));

    expect(toast.error).toHaveBeenCalledWith("Something went wrong");
  });
});
