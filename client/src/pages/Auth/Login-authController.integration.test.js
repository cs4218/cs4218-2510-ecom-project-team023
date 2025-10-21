import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import toast from "react-hot-toast";
import axios from "axios";

import {
  connectToTestDb,
  disconnectFromTestDb,
  resetTestDb,
} from "../../../../config/testdb.js";
import app from "../../../../server.js";
import userModel from "../../../../models/userModel.js";
import { hashPassword } from "../../../../helpers/authHelper.js";
import Login from "../../pages/Auth/Login";

jest.mock("../../components/Layout", () => ({ children }) => (
  <div data-testid="layout">{children}</div>
));

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockSetAuth = jest.fn();
jest.mock("../../context/auth", () => ({
  useAuth: jest.fn(() => [null, mockSetAuth]),
}));

beforeAll(async () => {
  await connectToTestDb("login-int-tests");
});

afterAll(async () => {
  await disconnectFromTestDb();
});

describe("Login page integration tests with backend authController", () => {
  let server;
  let port;
  let axiosPostSpy;

  beforeEach(async () => {
    await resetTestDb();
    server = app.listen(7458);
    port = server.address().port;
    axios.defaults.baseURL = `http://localhost:${port}`;
    axiosPostSpy = jest.spyOn(axios, "post");

    const hashed = await hashPassword("strongpass");
    await userModel.create({
      name: "Valid User",
      email: "example@example.com",
      password: hashed,
      phone: "91234567",
      address: "123 Street",
      answer: "Football",
    });

    const hashedWrong = await hashPassword("correctpass");
    await userModel.create({
      name: "Wrong Password User",
      email: "wrong@example.com",
      password: hashedWrong,
      phone: "98765432",
      address: "Wrong Street",
      answer: "Football",
    });

    jest.clearAllMocks();
  });

  afterEach(async () => {
    axiosPostSpy.mockRestore();
    await new Promise((res) => setTimeout(res, 50));
    await new Promise((resolve) => server.close(resolve));
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

  test("should log in successfully when given valid credentials", async () => {
    setup();

    fireEvent.change(screen.getByPlaceholderText("Enter Your Email"), {
      target: { value: "example@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Password"), {
      target: { value: "strongpass" },
    });
    fireEvent.click(screen.getByText("LOGIN"));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "login successfully",
        expect.any(Object)
      )
    );
    expect(axiosPostSpy).toHaveBeenCalledTimes(1);
    expect(axiosPostSpy).toHaveBeenCalledWith(
      "/api/v1/auth/login",
      expect.objectContaining({
        email: "example@example.com",
        password: "strongpass",
      })
    );
    const stored = JSON.parse(localStorage.getItem("auth"));
    expect(stored.user.email).toBe("example@example.com");
    expect(typeof stored.token).toBe("string");
  });

  test("should show an error toast message for non-existent user", async () => {
    setup();

    fireEvent.change(screen.getByPlaceholderText("Enter Your Email"), {
      target: { value: "ghost@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Password"), {
      target: { value: "whatever" },
    });
    fireEvent.click(screen.getByText("LOGIN"));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Email is not registered")
    );

    expect(axiosPostSpy).toHaveBeenCalledTimes(1);
  });

  test("should show an error toast message if given wrong password", async () => {
    setup();

    fireEvent.change(screen.getByPlaceholderText("Enter Your Email"), {
      target: { value: "wrong@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Password"), {
      target: { value: "badpass" },
    });
    fireEvent.click(screen.getByText("LOGIN"));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Invalid Password")
    );
    expect(axiosPostSpy).toHaveBeenCalledTimes(1);
  });

  test("should fail gracefully with error toast message if there is database error", async () => {
    setup();

    // Original Approach: Simulate database failure by closing the test database connection
    // await disconnectFromTestDb();
    // This approach might cause problems for subsequent tests, so we use jest.spyOn to mock database failure instead
    jest
      .spyOn(userModel, "findOne")
      .mockRejectedValueOnce(new Error("Database error"));

    fireEvent.change(screen.getByPlaceholderText("Enter Your Email"), {
      target: { value: "example@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Password"), {
      target: { value: "strongpass" },
    });
    fireEvent.click(screen.getByText("LOGIN"));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Something went wrong")
    );
    expect(axiosPostSpy).toHaveBeenCalledTimes(1);
  });

  test("should not log in if required fields are missing", async () => {
    setup();

    fireEvent.change(screen.getByPlaceholderText("Enter Your Email"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Password"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByText("LOGIN"));

    const email = screen.getByPlaceholderText("Enter Your Email");
    const password = screen.getByPlaceholderText("Enter Your Password");
    expect(email.validity.valid).toBe(false);
    expect(password.validity.valid).toBe(false);
    expect(axiosPostSpy).not.toHaveBeenCalled();
    expect(screen.getByText("LOGIN FORM")).toBeInTheDocument();
  });
});
