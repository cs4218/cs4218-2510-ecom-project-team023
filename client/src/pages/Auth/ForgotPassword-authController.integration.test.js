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
import ForgotPassword from "../../pages/Auth/ForgotPassword";

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

beforeAll(async () => {
  await connectToTestDb("forgotpassword-int-tests");
});

afterAll(async () => {
  await disconnectFromTestDb();
});

describe("Forgot Password page integration tests with backend authController", () => {
  let server;
  let port;
  let axiosPostSpy;

  beforeEach(async () => {
    await resetTestDb();
    server = app.listen(0);
    port = server.address().port;
    axios.defaults.baseURL = `http://localhost:${port}`;
    axiosPostSpy = jest.spyOn(axios, "post");
    jest.clearAllMocks();
  });

  afterEach(async () => {
    axiosPostSpy.mockRestore();
    await new Promise((res) => setTimeout(res, 50));
    await new Promise((resolve) => server.close(resolve));
  });

  const setup = () =>
    render(
      <MemoryRouter initialEntries={["/forgot-password"]}>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    );

  test("should reset password successfully and navigate to login page when valid credentials are provided", async () => {
    const hashed = await hashPassword("oldpass");
    await userModel.create({
      name: "Reset User",
      email: "reset@example.com",
      password: hashed,
      phone: "88887777",
      address: "Reset Street",
      DOB: "2000-01-01",
      answer: "Football",
    });

    setup();

    fireEvent.change(screen.getByPlaceholderText("Enter Your Email"), {
      target: { value: "reset@example.com" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Enter Your Favourite Sports"),
      {
        target: { value: "Football" },
      }
    );
    fireEvent.change(screen.getByPlaceholderText("Enter New Password"), {
      target: { value: "newstrongpass" },
    });

    fireEvent.click(screen.getByText("RESET PASSWORD"));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "Password Reset Successfully",
        expect.any(Object)
      )
    );
    expect(await screen.findByText("Login Page")).toBeInTheDocument();
    expect(axiosPostSpy).toHaveBeenCalledTimes(1);
    expect(axiosPostSpy).toHaveBeenCalledWith(
      "/api/v1/auth/forgot-password",
      expect.objectContaining({
        email: "reset@example.com",
        answer: "Football",
        newPassword: "newstrongpass",
      })
    );

    // verify password is updated in the database
    const updatedUser = await userModel.findOne({ email: "reset@example.com" });
    expect(updatedUser).not.toBeNull();
    expect(updatedUser.password).not.toBe(hashed);
  });

  test("should show an error toast message when provided with wrong answer to favourite sports", async () => {
    const hashed = await hashPassword("oldpass");
    await userModel.create({
      name: "Wrong Answer User",
      email: "wronganswer@example.com",
      password: hashed,
      phone: "88886666",
      address: "Wrong Street",
      DOB: "2000-01-01",
      answer: "Basketball",
    });

    setup();

    fireEvent.change(screen.getByPlaceholderText("Enter Your Email"), {
      target: { value: "wronganswer@example.com" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Enter Your Favourite Sports"),
      {
        target: { value: "Football" },
      }
    );
    fireEvent.change(screen.getByPlaceholderText("Enter New Password"), {
      target: { value: "newpass123" },
    });

    fireEvent.click(screen.getByText("RESET PASSWORD"));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Wrong Email Or Answer")
    );
    expect(axiosPostSpy).toHaveBeenCalledTimes(1);
  });

  test("should show an error toast message for non-existent user", async () => {
    setup();

    fireEvent.change(screen.getByPlaceholderText("Enter Your Email"), {
      target: { value: "ghost@example.com" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Enter Your Favourite Sports"),
      {
        target: { value: "Football" },
      }
    );
    fireEvent.change(screen.getByPlaceholderText("Enter New Password"), {
      target: { value: "newpass123" },
    });

    fireEvent.click(screen.getByText("RESET PASSWORD"));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Wrong Email Or Answer")
    );
    expect(axiosPostSpy).toHaveBeenCalledTimes(1);
  });

  test("should show an error terror message when new password is too short", async () => {
    const hashed = await hashPassword("oldpass");
    await userModel.create({
      name: "Short Pass User",
      email: "short@example.com",
      password: hashed,
      phone: "88885555",
      address: "Short Street",
      DOB: "2000-01-01",
      answer: "Tennis",
    });

    setup();

    fireEvent.change(screen.getByPlaceholderText("Enter Your Email"), {
      target: { value: "short@example.com" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Enter Your Favourite Sports"),
      {
        target: { value: "Tennis" },
      }
    );
    fireEvent.change(screen.getByPlaceholderText("Enter New Password"), {
      target: { value: "123" },
    });

    fireEvent.click(screen.getByText("RESET PASSWORD"));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Password must be at least 6 characters long"
      )
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
      target: { value: "reset@example.com" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Enter Your Favourite Sports"),
      {
        target: { value: "Football" },
      }
    );
    fireEvent.change(screen.getByPlaceholderText("Enter New Password"), {
      target: { value: "newstrongpass" },
    });

    fireEvent.click(screen.getByText("RESET PASSWORD"));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Something went wrong")
    );
    expect(axiosPostSpy).toHaveBeenCalledTimes(1);
  });

  test("should not reset password if required fields are missing", async () => {
    setup();

    fireEvent.change(screen.getByPlaceholderText("Enter Your Email"), {
      target: { value: "" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Enter Your Favourite Sports"),
      {
        target: { value: "" },
      }
    );
    fireEvent.change(screen.getByPlaceholderText("Enter New Password"), {
      target: { value: "" },
    });

    fireEvent.click(screen.getByText("RESET PASSWORD"));

    const email = screen.getByPlaceholderText("Enter Your Email");
    const answer = screen.getByPlaceholderText("Enter Your Favourite Sports");
    const password = screen.getByPlaceholderText("Enter New Password");
    expect(email.validity.valid).toBe(false); // HTML5 required attribute prevents submission
    expect(answer.validity.valid).toBe(false);
    expect(password.validity.valid).toBe(false);
    // ensure we are still on the forgot password page
    expect(screen.getByText("FORGOT PASSWORD")).toBeInTheDocument();
    expect(axiosPostSpy).not.toHaveBeenCalled();
  });
});
