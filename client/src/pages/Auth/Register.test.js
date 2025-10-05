import React from "react";
import { render, fireEvent, waitFor, screen } from "@testing-library/react";
import axios from "axios";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import "@testing-library/jest-dom/extend-expect";
import toast from "react-hot-toast";
import Register from "./Register";

// ---- Mock setup ----
jest.mock("axios");
jest.mock("react-hot-toast");

jest.mock("../../context/auth", () => ({
  useAuth: jest.fn(() => [null, jest.fn()]),
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

describe("Register Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const setup = () =>
    render(
      <MemoryRouter initialEntries={["/register"]}>
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    );

  test("should render registration form correctly", () => {
    setup();
    expect(screen.getByText("REGISTER FORM")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter Your Name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter Your Email")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Enter Your Password")
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Enter Your Phone Number")
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Enter Your Address")
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter Your DOB")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("What is Your Favorite Sports?")
    ).toBeInTheDocument();
  });

  test("should show toast error when registration is unsuccessful", async () => {
    axios.post.mockResolvedValueOnce({
      data: { success: false, message: "Unsuccessful Registration" },
    });

    setup();
    fireEvent.change(screen.getByPlaceholderText("Enter Your Name"), {
      target: { value: "John Doe" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Email"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Password"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Phone Number"), {
      target: { value: "1234567890" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Address"), {
      target: { value: "123 Street" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your DOB"), {
      target: { value: "2000-01-01" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("What is Your Favorite Sports?"),
      {
        target: { value: "Football" },
      }
    );

    fireEvent.click(screen.getByText("REGISTER"));

    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));

    expect(toast.error).toHaveBeenCalledWith("Unsuccessful Registration");
  });

  test("should register the user successfully", async () => {
    axios.post.mockResolvedValueOnce({ data: { success: true } });

    setup();
    fireEvent.change(screen.getByPlaceholderText("Enter Your Name"), {
      target: { value: "John Doe" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Email"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Password"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Phone Number"), {
      target: { value: "1234567890" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Address"), {
      target: { value: "123 Street" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your DOB"), {
      target: { value: "2000-01-01" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("What is Your Favorite Sports?"),
      {
        target: { value: "Football" },
      }
    );

    fireEvent.click(screen.getByText("REGISTER"));

    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));

    expect(toast.success).toHaveBeenCalledWith(
      "Registered successfully, please login"
    );
  });

  test("should show error message when password is too short", async () => {
    axios.post.mockRejectedValueOnce({
      response: {
        data: { message: "Password must be at least 6 characters long" },
        status: 400,
      },
    });

    setup();
    fireEvent.change(screen.getByPlaceholderText("Enter Your Name"), {
      target: { value: "John Doe" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Email"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Password"), {
      target: { value: "12345" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Phone Number"), {
      target: { value: "1234567890" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Address"), {
      target: { value: "123 Street" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your DOB"), {
      target: { value: "2000-01-01" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("What is Your Favorite Sports?"),
      {
        target: { value: "Football" },
      }
    );

    fireEvent.click(screen.getByText("REGISTER"));

    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));

    expect(toast.error).toHaveBeenCalledWith(
      "Password must be at least 6 characters long"
    );
  });

  test("should show error message when user already exists", async () => {
    axios.post.mockRejectedValueOnce({
      response: {
        data: {
          success: false,
          message: "User already registered, please login",
        },
        status: 409,
      },
    });

    setup();
    fireEvent.change(screen.getByPlaceholderText("Enter Your Name"), {
      target: { value: "John Doe" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Email"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Password"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Phone Number"), {
      target: { value: "1234567890" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Address"), {
      target: { value: "123 Street" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your DOB"), {
      target: { value: "2000-01-01" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("What is Your Favorite Sports?"),
      {
        target: { value: "Football" },
      }
    );

    fireEvent.click(screen.getByText("REGISTER"));

    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));

    expect(toast.error).toHaveBeenCalledWith(
      "User already registered, please login"
    );
  });

  test("should handle backend error gracefully", async () => {
    axios.post.mockRejectedValueOnce({
      response: {
        data: { message: "Error while registering user" },
        status: 500,
      },
    });

    setup();
    fireEvent.change(screen.getByPlaceholderText("Enter Your Name"), {
      target: { value: "John Doe" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Email"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Password"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Phone Number"), {
      target: { value: "1234567890" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Address"), {
      target: { value: "123 Street" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your DOB"), {
      target: { value: "2000-01-01" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("What is Your Favorite Sports?"),
      {
        target: { value: "Football" },
      }
    );

    fireEvent.click(screen.getByText("REGISTER"));

    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));

    expect(toast.error).toHaveBeenCalledWith("Something went wrong");
  });
});
