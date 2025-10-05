import React from "react";
import { render, waitFor, screen } from "@testing-library/react";
import axios from "axios";
import toast from "react-hot-toast";
import { MemoryRouter } from "react-router-dom";
import AdminRoute from "./AdminRoute";

jest.mock("axios");
jest.mock("react-hot-toast");
jest.mock("../../context/auth", () => ({
  useAuth: jest.fn(),
}));
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  Outlet: () => <div>Admin Protected Content</div>,
}));
jest.mock("../Spinner", () => () => <div>Loading Spinner</div>);

describe("AdminRoute Component", () => {
  const mockSetAuth = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    require("../../context/auth").useAuth.mockReturnValue([
      { user: { name: "Admin" }, token: "fakeAdminToken" },
      mockSetAuth,
    ]);
  });

  const setup = () =>
    render(
      <MemoryRouter>
        <AdminRoute />
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
      expect(screen.getByText("Admin Protected Content")).toBeInTheDocument();
    });
    expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/admin-auth");
  });

  test("should render Spinner when backend returns ok=false", async () => {
    axios.get.mockResolvedValueOnce({ data: { ok: false } });

    setup();

    await waitFor(() => {
      expect(screen.getByText("Loading Spinner")).toBeInTheDocument();
    });
  });

  test("should log error when axios throws an exception", async () => {
    const mockError = new Error("Network failure");
    axios.get.mockRejectedValueOnce(mockError);
    console.log = jest.fn();

    setup();

    await waitFor(() => {
      expect(console.log).toHaveBeenCalledWith("Admin auth check failed");
      expect(console.log).toHaveBeenCalledWith(mockError);
      expect(screen.getByText("Loading Spinner")).toBeInTheDocument();
    });
  });
});
