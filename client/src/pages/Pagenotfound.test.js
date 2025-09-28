// Some tests written with help of AI
// client/src/pages/Pagenotfound.test.js
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";

// Mock Layout to surface the title prop for easy assertion
jest.mock("../components/Layout", () => {
  const React = require("react");
  const LayoutMock = ({ children, title }) => (
    <div data-testid="layout" data-title={title}>
      {children}
    </div>
  );
  return { __esModule: true, default: LayoutMock };
});

import Pagenotfound from "./Pagenotfound";

describe("Pagenotfound page", () => {
  const renderWithRouter = (ui) =>
    render(<MemoryRouter>{ui}</MemoryRouter>);

  test("wraps content with Layout and passes title", () => {
    renderWithRouter(<Pagenotfound />);
    const layout = screen.getByTestId("layout");
    expect(layout).toHaveAttribute("data-title", "go back- page not found");
  });

  test("renders 404 headings", () => {
    renderWithRouter(<Pagenotfound />);
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByText("Oops ! Page Not Found")).toBeInTheDocument();
  });

  test("renders 'Go Back' link pointing to home", () => {
    renderWithRouter(<Pagenotfound />);
    const link = screen.getByRole("link", { name: /go back/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/");
  });
});
