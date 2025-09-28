// Some tests written with help of AI
import React from "react";
import About from "./About";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";

// Mock Layout so Header/Footer/Helmet don't interfere and we can assert the title prop.
jest.mock("./../components/Layout", () => {
  const React = require("react");
  const LayoutMock = jest.fn(({ children, title }) => (
    <div data-testid="layout" data-title={title}>
      {children}
    </div>
  ));
  return { __esModule: true, default: LayoutMock };
});


describe("About page", () => {
  test("wraps content with Layout and passes the expected title", () => {
    render(<About />);
    const layout = screen.getByTestId("layout");
    expect(layout).toBeInTheDocument();
    expect(layout).toHaveAttribute("data-title", "About us - Ecommerce app");
  });

  test("renders the about image with expected alt text", () => {
    render(<About />);
    const img = screen.getByAltText("contactus");
    expect(img).toBeInTheDocument();
  });

  test("renders the body paragraph content", () => {
    render(<About />);
    expect(screen.getByText(/Add text/i)).toBeInTheDocument();
  });
});
