// Some tests written with help of AI
// Contact.test.jsx
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";

// Mock Layout so we don't pull Header/Footer/Helmet/etc.
// Also capture the title prop for assertion.
jest.mock("./../components/Layout", () => {
  const React = require("react");
  const LayoutMock = jest.fn(({ children, title }) => (
    <div data-testid="layout" data-title={title}>
      {children}
    </div>
  ));
  return { __esModule: true, default: LayoutMock };
});

import Contact from "./Contact";

describe("Contact page", () => {
  test("wraps content with Layout and passes title", () => {
    render(<Contact />);
    const layout = screen.getByTestId("layout");
    expect(layout).toBeInTheDocument();
    expect(layout).toHaveAttribute("data-title", "Contact us");
  });

  test("renders the hero image", () => {
    render(<Contact />);
    // alt text from component: "contactus"
    const img = screen.getByAltText("contactus");
    expect(img).toBeInTheDocument();
  });

  test("shows the CONTACT US heading", () => {
    render(<Contact />);
    expect(
      screen.getByRole("heading", { name: /contact us/i, level: 1 })
    ).toBeInTheDocument();
  });

  test("shows email line", () => {
    render(<Contact />);
    expect(
      screen.getByText(/📧\s*www\.help@ecommerceapp\.com/i)
    ).toBeInTheDocument();
  });

  test("shows phone line", () => {
    render(<Contact />);
    expect(screen.getByText(/📞\s*012-3456789/i)).toBeInTheDocument();
  });

  test("shows toll-free support line", () => {
    render(<Contact />);
    expect(
      screen.getByText(/🎧\s*1800-0000-0000\s*\(toll free\)/i)
    ).toBeInTheDocument();
  });
});
