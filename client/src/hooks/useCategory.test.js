import React from "react";
import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("axios", () => {
  const mock = { get: jest.fn() };
  return { __esModule: true, default: mock };
});
import axios from "axios";

/* -------- import hook AFTER mocks -------- */
import useCategory from "./useCategory";

/* -------- helpers -------- */
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

/* A consumer that UNSAFELY maps categories. If the hook ever sets undefined,
   this component will throw during render. */
function UnsafeList() {
  const cats = useCategory();
  return (
    <ul data-testid="unsafe-list">
      {cats.map((c) => (
        <li key={c._id}>{c.name}</li>
      ))}
    </ul>
  );
}

/* A consumer that shows the length safely (to detect normalization). */
function SafeLen() {
  const cats = useCategory();
  const len = Array.isArray(cats) ? cats.length : "not-array";
  return <div data-testid="len">len:{len}</div>;
}

/* Minimal error boundary to catch render crashes from UnsafeList */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }
  static getDerivedStateFromError(err) {
    return { err };
  }
  render() {
    if (this.state.err) return <div data-testid="eb">EB:ERROR</div>;
    return this.props.children;
  }
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useCategory regressions (expected to fail until hook is fixed)", () => {
  test("normalizes missing payload to an empty array (not undefined)", async () => {
    // Resolve with NO category property -> current code sets undefined
    const d = deferred();
    axios.get.mockReturnValueOnce(d.promise);

    render(<SafeLen />);

    // initial ([]) -> len:0
    expect(screen.getByTestId("len")).toHaveTextContent("len:0");

    await act(async () => {
      d.resolve({ data: {} });
    });

    // Desired: still len:0 (normalized to [])
    // Current: becomes 'not-array' because hook sets undefined
    expect(screen.getByTestId("len")).toHaveTextContent("len:0");
  });

  test("does not crash mapping consumer when API omits category (UnsafeList)", async () => {
    // Return no 'category' key; hook will set undefined -> re-render -> crash
    const d = deferred();
    axios.get.mockReturnValueOnce(d.promise);

    render(
      <ErrorBoundary>
        <UnsafeList />
      </ErrorBoundary>
    );

    // First render is fine (empty []), then update triggers error
    await act(async () => {
      d.resolve({ data: {} });
    });

    // Desired: no error boundary triggered after fix
    // Current: EB shows because UnsafeList crashes
    expect(screen.queryByTestId("eb")).not.toBeInTheDocument();
  });

  test("does not set state after unmount (no React warning)", async () => {
    // Slow request; unmount before resolve -> current code sets state after unmount
    const d = deferred();
    axios.get.mockReturnValueOnce(d.promise);

    const spy = jest.spyOn(console, "error").mockImplementation(() => {});

    const { unmount } = render(<SafeLen />);

    unmount();

    await act(async () => {
      d.resolve({ data: { category: [{ _id: "1", name: "Phones" }] } });
    });

    // Desired: no React warning after fix (using AbortController/isMounted guard)
    // Current: console.error includes "Can't perform a React state update on an unmounted component"
    const calls = spy.mock.calls.map((args) => args.join(" "));
    const hadUnmountWarning = calls.some((msg) =>
      /can't perform a react state update on an unmounted component/i.test(msg)
    );
    expect(hadUnmountWarning).toBe(false);

    spy.mockRestore();
  });
});

/* Happy path */
describe("useCategory happy path", () => {
  test("returns array when API provides category list", async () => {
    const d = deferred();
    axios.get.mockReturnValueOnce(d.promise);

    render(<SafeLen />);

    // initial []
    expect(screen.getByTestId("len")).toHaveTextContent("len:0");

    await act(async () => {
      d.resolve({
        data: { category: [{ _id: "a", name: "A" }, { _id: "b", name: "B" }] },
      });
    });

    expect(screen.getByTestId("len")).toHaveTextContent("len:2");
    expect(axios.get).toHaveBeenCalledWith("/api/v1/category/get-category");
  });
});
