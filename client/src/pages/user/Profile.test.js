// Test has been written with the help of AI.
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Profile from "../pages/user/Profile";
import { useAuth } from "../context/auth";
import axios from "axios";
import toast from "react-hot-toast";

// Mock dependencies
jest.mock("../context/auth");
jest.mock("axios");
jest.mock("react-hot-toast");

describe("Profile Page", () => {
  let mockAuth;
  let mockSetAuth;

  beforeEach(() => {
    mockAuth = { user: { name: "Alice", email: "alice@test.com", phone: "91234567", address: "SG" } };
    mockSetAuth = jest.fn();
    useAuth.mockReturnValue([mockAuth, mockSetAuth]);

    localStorage.setItem("auth", JSON.stringify(mockAuth));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("renders initial user data from auth context", () => {
    render(<Profile />);
    expect(screen.getByPlaceholderText("Enter Your Name")).toHaveValue("Alice");
    expect(screen.getByPlaceholderText("Enter Your Email ")).toHaveValue("alice@test.com");
    expect(screen.getByPlaceholderText("Enter Your Phone")).toHaveValue("91234567");
    expect(screen.getByPlaceholderText("Enter Your Address")).toHaveValue("SG");
  });

  test("email field should be disabled", () => {
    render(<Profile />);
    expect(screen.getByPlaceholderText("Enter Your Email ")).toBeDisabled();
  });

  test("empty password still allows update", async () => {
    axios.put.mockResolvedValue({ data: { updatedUser: { ...mockAuth.user, name: "Alice Updated" } } });

    render(<Profile />);
    fireEvent.change(screen.getByPlaceholderText("Enter Your Name"), { target: { value: "Alice Updated" } });
    fireEvent.click(screen.getByText("UPDATE"));

    await waitFor(() => {
      expect(mockSetAuth).toHaveBeenCalledWith({
        ...mockAuth,
        user: { ...mockAuth.user, name: "Alice Updated" },
      });
      expect(toast.success).toHaveBeenCalledWith("Profile Updated Successfully");
    });
  });

  test("invalid server response should show error toast", async () => {
    axios.put.mockResolvedValue({ data: { error: "Update failed" } });

    render(<Profile />);
    fireEvent.click(screen.getByText("UPDATE"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Update failed");
    });
  });

  test("handles axios failure gracefully", async () => {
    axios.put.mockRejectedValue(new Error("Network Error"));

    render(<Profile />);
    fireEvent.click(screen.getByText("UPDATE"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Something went wrong");
    });
  });

  test("password at minimum length (1 char)", async () => {
    axios.put.mockResolvedValue({ data: { updatedUser: { ...mockAuth.user, password: "a" } } });

    render(<Profile />);
    fireEvent.change(screen.getByPlaceholderText("Enter Your Password"), { target: { value: "a" } });
    fireEvent.click(screen.getByText("UPDATE"));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
    });
  });

  test("password at large length (256 chars)", async () => {
    const longPassword = "a".repeat(256);
    axios.put.mockResolvedValue({ data: { updatedUser: { ...mockAuth.user, password: longPassword } } });

    render(<Profile />);
    fireEvent.change(screen.getByPlaceholderText("Enter Your Password"), { target: { value: longPassword } });
    fireEvent.click(screen.getByText("UPDATE"));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
    });
  });

  test("updates localStorage after successful update", async () => {
    axios.put.mockResolvedValue({ data: { updatedUser: { ...mockAuth.user, name: "LocalStorage Test" } } });

    render(<Profile />);
    fireEvent.change(screen.getByPlaceholderText("Enter Your Name"), { target: { value: "LocalStorage Test" } });
    fireEvent.click(screen.getByText("UPDATE"));

    await waitFor(() => {
      const ls = JSON.parse(localStorage.getItem("auth"));
      expect(ls.user.name).toBe("LocalStorage Test");
    });
  });
});
