import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import axios from "axios";
import { AuthProvider, useAuth } from "./auth";

jest.mock("axios");

const MOCK_AUTH_DATA = {
  user: {
    address: "address",
    email: "email@email.com",
    name: "John Doe",
    phone: "123456789",
    role: 0,
    _id: "1",
  },
  token: "mock_token_123",
};

const FakeTestComponent = () => {
  const [auth, setAuth] = useAuth();

  return (
    <div>
      <div data-testid="user">{auth.user ? auth.user.name : "No User"}</div>
      <div data-testid="token">{auth.token}</div>
      <button onClick={() => setAuth(MOCK_AUTH_DATA)}>Update</button>
      <button onClick={() => setAuth({ user: null, token: "" })}>Clear</button>
    </div>
  );
};

describe("AuthProvider Test Cases", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  test("should render initial values correctly", () => {
    render(
      <AuthProvider>
        <FakeTestComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId("user")).toHaveTextContent("No User");
    expect(screen.getByTestId("token")).toHaveTextContent("");
  });

  test("should update auth state via setAuth", async () => {
    render(
      <AuthProvider>
        <FakeTestComponent />
      </AuthProvider>
    );

    act(() => {
      screen.getByText("Update").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("user")).toHaveTextContent("John Doe");
      expect(screen.getByTestId("token")).toHaveTextContent("mock_token_123");
    });
  });

  test("should load auth state from localStorage on mount", async () => {
    window.localStorage.getItem.mockReturnValue(JSON.stringify(MOCK_AUTH_DATA));

    render(
      <AuthProvider>
        <FakeTestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(window.localStorage.getItem).toHaveBeenCalledWith("auth");
      expect(screen.getByTestId("user")).toHaveTextContent("John Doe");
      expect(screen.getByTestId("token")).toHaveTextContent("mock_token_123");
    });
  });

  test("should set axios default Authorization header when token is present", async () => {
    window.localStorage.getItem.mockReturnValue(JSON.stringify(MOCK_AUTH_DATA));

    render(
      <AuthProvider>
        <FakeTestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(axios.defaults.headers.common["Authorization"]).toBe(
        "mock_token_123"
      );
    });
  });

  test("should clear auth state via setAuth", async () => {
    render(
      <AuthProvider>
        <FakeTestComponent />
      </AuthProvider>
    );

    // Update auth state
    act(() => {
      screen.getByText("Update").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("user")).toHaveTextContent("John Doe");
      expect(screen.getByTestId("token")).toHaveTextContent("mock_token_123");
    });

    // Clear auth state
    act(() => {
      screen.getByText("Clear").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("user")).toHaveTextContent("No User");
      expect(screen.getByTestId("token")).toHaveTextContent("");
    });
  });

  test("should not set axios Authorization header when token is empty", async () => {
    render(
      <AuthProvider>
        <FakeTestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(axios.defaults.headers.common["Authorization"]).toBe("");
    });
  });

  test("should handle missing localStorage data", async () => {
    window.localStorage.getItem.mockReturnValue(null);

    render(
      <AuthProvider>
        <FakeTestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(window.localStorage.getItem).toHaveBeenCalledWith("auth");
      expect(screen.getByTestId("user")).toHaveTextContent("No User");
      expect(screen.getByTestId("token")).toHaveTextContent("");
    });
  });
});
