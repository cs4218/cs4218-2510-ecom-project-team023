// Some tests written with help of AI
// client/src/pages/Policy.test.js
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";

// Mock CSS
jest.mock("../styles/Homepages.css", () => ({}));

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

import Policy from "./Policy";

describe("Policy page", () => {
  test("wraps content with Layout and passes title", () => {
    render(<Policy />);
    const layout = screen.getByTestId("layout");
    expect(layout).toHaveAttribute("data-title", "Privacy Policy");
  });

  test("renders the contact image", () => {
    render(<Policy />);
    const img = screen.getByAltText("contactus");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "/images/contactus.jpeg");
  });

  test("renders all privacy policy paragraphs", () => {
    render(<Policy />);
    const paras = screen.getAllByText(/add privacy policy/i);
    expect(paras).toHaveLength(7);
  });
});
