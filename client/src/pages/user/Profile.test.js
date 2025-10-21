// client/src/__tests__/unit/Profile/Profile.test.js
// Test has been written with the help of AI and refined for correctness.
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Profile from "./Profile";
import { useAuth } from "../../context/auth";
import axios from "axios";
import toast from "react-hot-toast";
import { message } from "antd";

jest.mock("../../context/auth");
jest.mock("axios");
jest.mock("react-hot-toast");

jest.mock("../../components/Layout", () => ({ children }) => (
  <div>{children}</div>
));
jest.mock("../../components/UserMenu", () => () => <div>UserMenu</div>);

describe("Profile Page", () => {
  let mockAuth;
  let mockSetAuth;

  beforeEach(() => {
    mockAuth = {
      user: {
        name: "Alice",
        email: "alice@test.com",
        phone: "91234567",
        address: "SG",
      },
    };
    mockSetAuth = jest.fn();
    useAuth.mockReturnValue([mockAuth, mockSetAuth]);
    localStorage.setItem("auth", JSON.stringify(mockAuth));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should render initial user data when component mounts", () => {
    render(<Profile />);

    expect(screen.getByPlaceholderText("Enter Your Name")).toHaveValue("Alice");
    expect(screen.getByPlaceholderText("Enter Your Email")).toHaveValue(
      "alice@test.com"
    );
    expect(screen.getByPlaceholderText("Enter Your Phone")).toHaveValue(
      "91234567"
    );
    expect(screen.getByPlaceholderText("Enter Your Address")).toHaveValue("SG");
  });

  test("should disable email input when rendering profile form", () => {
    render(<Profile />);
    expect(screen.getByPlaceholderText("Enter Your Email")).toBeDisabled();
  });

  test("should update profile successfully when no password is provided", async () => {
    axios.put.mockResolvedValue({
      data: {
        success: true,
        message: "Profile updated successfully",
        updatedUser: { ...mockAuth.user, name: "Alice Updated" },
      },
    });

    render(<Profile />);
    fireEvent.change(screen.getByPlaceholderText("Enter Your Name"), {
      target: { value: "Alice Updated" },
    });
    fireEvent.click(screen.getByText("UPDATE"));

    await waitFor(() => {
      expect(mockSetAuth).toHaveBeenCalledWith({
        ...mockAuth,
        user: { ...mockAuth.user, name: "Alice Updated" },
      });
    });
    expect(toast.success).toHaveBeenCalledWith(
      "Profile updated successfully",
      expect.any(Object)
    );
  });

  test("should show error toast when server returns a failure message", async () => {
    axios.put.mockResolvedValue({
      data: { success: false, message: "Update failed" },
    });

    render(<Profile />);

    fireEvent.click(screen.getByText("UPDATE"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Update failed");
    });
  });

  test("should handle axios rejection gracefully when network error occurs", async () => {
    axios.put.mockRejectedValue({
      response: { status: 500, data: { message: "Server crashed" } },
    });

    render(<Profile />);

    fireEvent.click(screen.getByText("UPDATE"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Something went wrong");
    });
  });

  test("should show 400 error message when API returns client-side error", async () => {
    axios.put.mockRejectedValue({
      response: { status: 400, data: { message: "Bad request" } },
    });

    render(<Profile />);

    fireEvent.click(screen.getByText("UPDATE"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Bad request");
    });
  });

  test("should not allow password with less than 6 characters", async () => {
    axios.put.mockRejectedValueOnce({
      response: {
        data: { message: "Password must be at least 6 characters long" },
        status: 400,
      },
    });

    render(<Profile />);
    fireEvent.change(screen.getByPlaceholderText("Enter Your Password"), {
      target: { value: "a" },
    });
    fireEvent.click(screen.getByText("UPDATE"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Password must be at least 6 characters long"
      );
    });
  });

  test("should update successfully when large password is provided", async () => {
    const longPassword = "a".repeat(256);
    axios.put.mockResolvedValue({
      data: {
        success: true,
        message: "Profile updated successfully",
        updatedUser: { ...mockAuth.user, password: longPassword },
      },
    });

    render(<Profile />);
    fireEvent.change(screen.getByPlaceholderText("Enter Your Password"), {
      target: { value: longPassword },
    });
    fireEvent.click(screen.getByText("UPDATE"));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "Profile updated successfully",
        expect.any(Object)
      );
    });
  });

  test("should call axios.put with correct body when updating phone and address", async () => {
    axios.put.mockResolvedValue({
      data: {
        success: true,
        message: "Profile updated successfully",
        updatedUser: {
          ...mockAuth.user,
          phone: "98765432",
          address: "New Address",
        },
      },
    });

    render(<Profile />);

    fireEvent.change(screen.getByPlaceholderText("Enter Your Phone"), {
      target: { value: "98765432" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Address"), {
      target: { value: "New Address" },
    });
    fireEvent.click(screen.getByText("UPDATE"));

    await waitFor(() => {
      expect(axios.put).toHaveBeenCalledWith("/api/v1/auth/profile", {
        name: mockAuth.user.name,
        email: mockAuth.user.email,
        password: "",
        phone: "98765432",
        address: "New Address",
      });
    });
    expect(toast.success).toHaveBeenCalledWith(
      "Profile updated successfully",
      expect.any(Object)
    );
  });

  test("should update localStorage when profile update succeeds", async () => {
    axios.put.mockResolvedValue({
      data: {
        success: true,
        updatedUser: { ...mockAuth.user, name: "Updated LS" },
      },
    });

    render(<Profile />);

    fireEvent.change(screen.getByPlaceholderText("Enter Your Name"), {
      target: { value: "Updated LS" },
    });
    fireEvent.click(screen.getByText("UPDATE"));

    await waitFor(() => {
      const ls = JSON.parse(localStorage.getItem("auth"));
      expect(ls.user.name).toBe("Updated LS");
    });
  });
});
