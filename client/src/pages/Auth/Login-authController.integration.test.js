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
import { AuthProvider } from "../../context/auth";

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
  await disconnectFromTestDb;
});

describe("Login page integration tests with backend authController", () => {
  let server;
  let port;

  beforeEach(async () => {
    await resetTestDb();
    server = app.listen(7458);
    port = server.address().port;
    axios.defaults.baseURL = `http://localhost:${port}`;

    // create a test user
    const hashed = await hashPassword("strongpass");
    await userModel.create({
      name: "Valid User",
      email: "example@example.com",
      password: hashed,
      phone: "91234567",
      address: "123 Street",
      answer: "Football",
    });

    // create a user for invalid password test
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
    await new Promise(res => setTimeout(res, 50));
    await new Promise(resolve => server.close(resolve));
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

  test("✅ logs in successfully with valid credentials", async () => {
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

    const stored = JSON.parse(localStorage.getItem("auth"));
    expect(stored.user.email).toBe("example@example.com");
    expect(typeof stored.token).toBe("string");
  });

  test("❌ shows 'Invalid Password' for wrong password", async () => {
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
  });

  test("📧 shows 'Email is not registered' for non-existent user", async () => {
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
  });
});
