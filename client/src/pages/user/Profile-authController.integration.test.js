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
import Profile from "./Profile.js";
import { AuthProvider } from "../../context/auth.js";
import JWT from "jsonwebtoken";

jest.mock("../../components/Layout", () => ({ children }) => (
  <div data-testid="layout">{children}</div>
));

jest.mock("../../components/UserMenu", () => () => (
  <div data-testid="usermenu">User Menu</div>
));

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

beforeAll(async () => {
  await connectToTestDb("profile-int-tests");
});

afterAll(async () => {
  await disconnectFromTestDb();
});

describe("Profile page integration tests with backend authController", () => {
  let server;
  let port;
  let axiosPutSpy;
  let user;

  beforeEach(async () => {
    await resetTestDb();
    server = app.listen(0);
    port = server.address().port;
    axios.defaults.baseURL = `http://localhost:${port}`;
    axiosPutSpy = jest.spyOn(axios, "put");

    const hashed = await hashPassword("oldpassword");
    user = await userModel.create({
      _id: "507f1f77bcf86cd799439011",
      name: "Existing User",
      email: "existing@example.com",
      password: hashed,
      phone: "91234567",
      address: "Old Address",
      answer: "Football",
    });

    const token = JWT.sign({ _id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });
    axios.defaults.headers.common["authorization"] = token;
    localStorage.clear();
    localStorage.setItem("auth", JSON.stringify({ token, user }));
  });

  afterEach(async () => {
    axiosPutSpy.mockRestore();
    jest.clearAllMocks();
    await new Promise((res) => setTimeout(res, 50));
    await new Promise((resolve) => server.close(resolve));
  });

  const setup = () =>
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/profile"]}>
          <Routes>
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

  test("should update profile successfully when given valid details", async () => {
    setup();

    fireEvent.change(screen.getByPlaceholderText("Enter Your Name"), {
      target: { value: "Updated User" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Phone"), {
      target: { value: "99998888" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Address"), {
      target: { value: "New Address" },
    });
    fireEvent.click(screen.getByText("UPDATE"));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "Profile updated successfully",
        expect.any(Object)
      )
    );
    expect(axiosPutSpy).toHaveBeenCalledTimes(1);
    expect(axiosPutSpy).toHaveBeenCalledWith(
      "/api/v1/auth/profile",
      expect.objectContaining({
        name: "Updated User",
        email: "existing@example.com",
        phone: "99998888",
        address: "New Address",
      })
    );

    const updatedUser = await userModel.findOne({
      email: "existing@example.com",
    });
    expect(updatedUser.name).toBe("Updated User");
    expect(updatedUser.phone).toBe("99998888");
    expect(updatedUser.address).toBe("New Address");
  });

  test("should show an error toast message when password is too short", async () => {
    setup();

    fireEvent.change(screen.getByPlaceholderText("Enter Your Password"), {
      target: { value: "123" },
    });
    fireEvent.click(screen.getByText("UPDATE"));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Password must be at least 6 characters long"
      )
    );
    expect(axiosPutSpy).toHaveBeenCalledTimes(1);
  });

  test("should fail gracefully with error toast message if there is database error", async () => {
    setup();

    // Original Approach: Simulate database failure by closing the test database connection
    // await disconnectFromTestDb();
    // This approach might cause problems for subsequent tests, so we use jest.spyOn to mock database failure instead
    jest
      .spyOn(userModel, "findById")
      .mockRejectedValueOnce(new Error("Database error"));

    fireEvent.change(screen.getByPlaceholderText("Enter Your Name"), {
      target: { value: "Updated User" },
    });
    fireEvent.click(screen.getByText("UPDATE"));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Something went wrong")
    );
    expect(axiosPutSpy).toHaveBeenCalledTimes(1);
  });
});
