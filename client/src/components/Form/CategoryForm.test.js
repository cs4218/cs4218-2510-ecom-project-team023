// CategoryForm.test.js
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/extend-expect";
import CategoryForm from "./CategoryForm";

// Small helpers to work with both old/new user-event
const type = async (el, text) => {
  if (typeof userEvent.setup === "function") {
    const u = userEvent.setup();
    await u.type(el, text);
  } else {
    await userEvent.type(el, text);
  }
};

const click = async (el) => {
  if (typeof userEvent.setup === "function") {
    const u = userEvent.setup();
    await u.click(el);
  } else {
    await userEvent.click(el);
  }
};

describe("CategoryForm", () => {
  test("renders input with placeholder and a Submit button", () => {
    render(
      <CategoryForm handleSubmit={jest.fn()} value="" setValue={jest.fn()} />
    );

    expect(
      screen.getByPlaceholderText(/enter new category/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /submit/i })
    ).toBeInTheDocument();
  });

  test("submitting the form calls handleSubmit", async () => {
    const handleSubmit = jest.fn((e) => e?.preventDefault?.());
    render(
      <CategoryForm
        handleSubmit={handleSubmit}
        value="Books"
        setValue={jest.fn()}
      />
    );

    await click(screen.getByRole("button", { name: /submit/i }));
    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  test("prop value controls the input (re-render reflects new value)", () => {
    const { rerender } = render(
      <CategoryForm
        handleSubmit={jest.fn()}
        value="Electronics"
        setValue={jest.fn()}
      />
    );
    const input = screen.getByPlaceholderText(/enter new category/i);
    expect(input).toHaveValue("Electronics");

    rerender(
      <CategoryForm handleSubmit={jest.fn()} value="Books" setValue={jest.fn()} />
    );
    expect(input).toHaveValue("Books");
  });

    test("typing path covers fallback branch when userEvent.setup is not a function", async () => {
        const originalSetup = userEvent.setup;
        // Force the fallback path
        // @ts-ignore
        userEvent.setup = undefined;

        try {
            const setValue = jest.fn();
            render(<CategoryForm handleSubmit={jest.fn()} value="" setValue={setValue} />);

            const input = screen.getByPlaceholderText(/enter new category/i);
            await type(input, "Books"); // uses the else branch (userEvent.type)

            // One call per key; join them to compare to the intended final string
            const values = setValue.mock.calls.map((c) => c[0]);
            expect(values.length).toBe("Books".length);
            expect(values.join("")).toBe("Books");
        } finally {
            // Always restore
            userEvent.setup = originalSetup;
        }
    });

});
