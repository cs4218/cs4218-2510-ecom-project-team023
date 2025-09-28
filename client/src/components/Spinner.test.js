// Some tests written with help of AI
// Spinner.test.jsx
import React from "react";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/extend-expect";
import Spinner from "./Spinner";

// Mock programmatic navigation so Router state doesn't change
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("Spinner (redirect countdown)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockNavigate.mockReset();
  });

  afterEach(() => {
    // Don't advance timers here (that would cause setState outside act)
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  test("renders initial countdown (3)", () => {
    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Spinner />
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { level: 1 }))
      .toHaveTextContent(/redirecting to you in\s*3\s*second/i);
  });

  test("counts down each second (3 → 2 → 1)", () => {
    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Spinner />
      </MemoryRouter>
    );

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByRole("heading", { level: 1 }))
      .toHaveTextContent(/redirecting to you in\s*2\s*second/i);

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByRole("heading", { level: 1 }))
      .toHaveTextContent(/redirecting to you in\s*1\s*second/i);
  });

  test("navigates to /login with state when countdown hits 0 (default path)", () => {
    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Spinner />
      </MemoryRouter>
    );

    // 3 ticks → reach 0 → navigate
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/login", { state: "/protected" });
  });

  test("respects custom path prop (e.g., 'forgot-password')", () => {
    render(
      <MemoryRouter initialEntries={["/secret"]}>
        <Spinner path="forgot-password" />
      </MemoryRouter>
    );

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/forgot-password", { state: "/secret" });
  });
});
