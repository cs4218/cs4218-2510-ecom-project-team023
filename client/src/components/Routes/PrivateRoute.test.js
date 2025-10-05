import React from "react";
import { render, waitFor, screen } from "@testing-library/react";
import axios from "axios";
import toast from "react-hot-toast";
import { MemoryRouter } from "react-router-dom";
import PrivateRoute from "./PrivateRoute";

// ---- Mock setup ----
jest.mock("axios");
jest.mock("react-hot-toast");
jest.mock("../../context/auth", () => ({
  useAuth: jest.fn(),
}));
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: jest.fn(),
  Outlet: () => <div>Protected Content</div>,
}));
jest.mock("../Spinner", () => () => <div>Loading Spinner</div>);

describe("PrivateRoute Component", () => {
  const mockSetAuth = jest.fn();
  const mockNavigate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    require("../../context/auth").useAuth.mockReturnValue([
      { user: { name: "Alice" }, token: "fakeToken" },
      mockSetAuth,
    ]);
    require("react-router-dom").useNavigate.mockReturnValue(mockNavigate);

    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      },
      writable: true,
    });
  });

  const setup = () =>
    render(
      <MemoryRouter>
        <PrivateRoute />
      </MemoryRouter>
    );

  test("should render Spinner when auth token is missing", async () => {
    require("../../context/auth").useAuth.mockReturnValue([
      { user: null, token: "" },
      mockSetAuth,
    ]);

    setup();

    expect(screen.getByText("Loading Spinner")).toBeInTheDocument();
    expect(axios.get).not.toHaveBeenCalled();
  });

  test("should render Outlet when backend returns ok=true", async () => {
    axios.get.mockResolvedValueOnce({ data: { ok: true } });

    setup();

    await waitFor(() => {
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
    expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/user-auth");
  });

  test("should handle expired session when backend returns ok=false", async () => {
    axios.get.mockResolvedValueOnce({ data: { ok: false } });

    setup();

    await waitFor(() => {
      expect(mockSetAuth).toHaveBeenCalledWith({ user: null, token: "" });
      expect(window.localStorage.removeItem).toHaveBeenCalledWith("auth");
      expect(toast.error).toHaveBeenCalledWith(
        "Session expired. Please log in again."
      );
      expect(mockNavigate).toHaveBeenCalledWith("/login");
      expect(screen.getByText("Loading Spinner")).toBeInTheDocument();
    });
  });

  test("should handle 401/403 response from backend", async () => {
    axios.get.mockRejectedValueOnce({ response: { status: 401 } });

    setup();

    await waitFor(() => {
      expect(mockSetAuth).toHaveBeenCalledWith({ user: null, token: "" });
      expect(window.localStorage.removeItem).toHaveBeenCalledWith("auth");
      expect(toast.error).toHaveBeenCalledWith(
        "Session expired. Please log in again."
      );
      expect(mockNavigate).toHaveBeenCalledWith("/login");
      expect(screen.getByText("Loading Spinner")).toBeInTheDocument();
    });
  });

  test("should handle unexpected errors gracefully", async () => {
    axios.get.mockRejectedValueOnce(new Error("Network failure"));
    console.error = jest.fn();

    setup();

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        "Unexpected auth error:",
        expect.any(Error)
      );
      expect(screen.getByText("Loading Spinner")).toBeInTheDocument();
    });
  });
});
