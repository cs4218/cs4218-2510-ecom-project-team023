import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import axios from "axios";
import toast from "react-hot-toast";
import { MemoryRouter } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import ForgotPassword from "./ForgotPassword";

jest.mock("axios");
jest.mock("react-hot-toast");
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: jest.fn(),
}));
jest.mock("../../components/Layout", () => ({ children }) => (
  <div>{children}</div>
));

describe("ForgotPassword Page", () => {
  const mockNavigate = jest.fn();

  beforeEach(() => {
    useNavigate.mockReturnValue(mockNavigate);
    jest.clearAllMocks();
  });

  const setup = () =>
    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>
    );

  test("should handle successful password reset and navigate to login", async () => {
    axios.post.mockResolvedValueOnce({
      data: { success: true, message: "Password Reset Successfully" },
    });

    setup();

    fireEvent.change(screen.getByPlaceholderText("Enter Your Email"), {
      target: { value: "alice@example.com" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Enter Your Favourite Sports"),
      {
        target: { value: "badminton" },
      }
    );
    fireEvent.change(screen.getByPlaceholderText("Enter New Password"), {
      target: { value: "newpass123" },
    });

    fireEvent.click(screen.getByText("RESET PASSWORD"));

    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));

    expect(toast.success).toHaveBeenCalledWith("Password Reset Successfully", {
      duration: 5000,
      icon: "🔑",
      style: { background: "green", color: "white" },
    });
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });

  test("should show error when unsuccessful reset", async () => {
    axios.post.mockResolvedValueOnce({
      data: { success: false, message: "Unsuccessful reset" },
    });

    setup();

    fireEvent.change(screen.getByPlaceholderText("Enter Your Email"), {
      target: { value: "bob@example.com" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Enter Your Favourite Sports"),
      {
        target: { value: "soccer" },
      }
    );
    fireEvent.change(screen.getByPlaceholderText("Enter New Password"), {
      target: { value: "wrongpass" },
    });

    fireEvent.click(screen.getByText("RESET PASSWORD"));

    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));
    expect(toast.error).toHaveBeenCalledWith("Unsuccessful reset");
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test("should show validation error message when backend returns 404 for wrong email", async () => {
    axios.post.mockRejectedValueOnce({
      response: {
        status: 404,
        data: { message: "Wrong Email Or Answer" },
      },
    });

    setup();

    fireEvent.change(screen.getByPlaceholderText("Enter Your Email"), {
      target: { value: "wrongemail@example.com" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Enter Your Favourite Sports"),
      {
        target: { value: "tennis" },
      }
    );
    fireEvent.change(screen.getByPlaceholderText("Enter New Password"), {
      target: { value: "pass" },
    });

    fireEvent.click(screen.getByText("RESET PASSWORD"));

    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));
    expect(toast.error).toHaveBeenCalledWith("Wrong Email Or Answer");
  });

  test("should show validation error message when backend returns 404 for wrong answer", async () => {
    axios.post.mockRejectedValueOnce({
      response: {
        status: 404,
        data: { message: "Wrong Email Or Answer" },
      },
    });

    setup();

    fireEvent.change(screen.getByPlaceholderText("Enter Your Email"), {
      target: { value: "email@example.com" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Enter Your Favourite Sports"),
      {
        target: { value: "wrong_answer" },
      }
    );
    fireEvent.change(screen.getByPlaceholderText("Enter New Password"), {
      target: { value: "pass" },
    });

    fireEvent.click(screen.getByText("RESET PASSWORD"));

    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));
    expect(toast.error).toHaveBeenCalledWith("Wrong Email Or Answer");
  });

  test("should show 'Something went wrong' for server errors", async () => {
    axios.post.mockRejectedValueOnce({
      response: { status: 500 },
    });

    setup();

    fireEvent.change(screen.getByPlaceholderText("Enter Your Email"), {
      target: { value: "john@example.com" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Enter Your Favourite Sports"),
      {
        target: { value: "basketball" },
      }
    );
    fireEvent.change(screen.getByPlaceholderText("Enter New Password"), {
      target: { value: "newpass321" },
    });

    fireEvent.click(screen.getByText("RESET PASSWORD"));

    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));
    expect(toast.error).toHaveBeenCalledWith("Something went wrong");
  });

  test("should show error if password length is less than 6", async () => {
    axios.post.mockRejectedValueOnce({
      response: {
        status: 400,
        data: { message: "Password must be at least 6 characters long" },
      },
    });

    setup();

    fireEvent.change(screen.getByPlaceholderText("Enter Your Email"), {
      target: { value: "charlie@example.com" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Enter Your Favourite Sports"),
      {
        target: { value: "golf" },
      }
    );
    fireEvent.change(screen.getByPlaceholderText("Enter New Password"), {
      target: { value: "12345" }, // boundary value (length = 5)
    });

    fireEvent.click(screen.getByText("RESET PASSWORD"));

    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));

    expect(toast.error).toHaveBeenCalledWith(
      "Password must be at least 6 characters long"
    );
  });

  test("should navigate to login page when button is clicked", async () => {
    setup();
    fireEvent.click(screen.getByText("Back to Login"));
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });
});
