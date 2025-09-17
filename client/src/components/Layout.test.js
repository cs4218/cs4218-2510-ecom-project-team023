// Layout.test.jsx
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import Layout from "./Layout";

// Mock Header / Footer to avoid pulling real hooks/contexts
jest.mock("./Header", () => () => <header data-testid="header" role="banner" />);
jest.mock("./Footer", () => () => <footer data-testid="footer">Footer</footer>);

// Mock Toaster so it doesn't mount the real one
jest.mock("react-hot-toast", () => ({
  Toaster: () => <div data-testid="toaster" />,
}));

describe("Layout", () => {
  test("renders header, footer, and children", () => {
    render(
      <Layout>
        <p>Page content</p>
      </Layout>
    );

    expect(screen.getByTestId("header")).toBeInTheDocument();
    expect(screen.getByText("Page content")).toBeInTheDocument();
    expect(screen.getByTestId("footer")).toBeInTheDocument();
  });

  test("renders Toaster once", () => {
    render(<Layout />);
    expect(screen.getByTestId("toaster")).toBeInTheDocument();
  });

  test("sets default title via Helmet", async () => {
    render(<Layout />);
    await waitFor(() =>
      expect(document.title).toBe("Ecommerce app - shop now")
    );
  });

  test("sets custom title and meta via Helmet", async () => {
    render(
      <Layout
        title="Custom Title"
        description="custom desc"
        keywords="a,b,c"
        author="Alice"
      />
    );

    await waitFor(() => expect(document.title).toBe("Custom Title"));

    await waitFor(() => {
      const metaDesc = document.querySelector('meta[name="description"]');
      const metaKeywords = document.querySelector('meta[name="keywords"]');
      const metaAuthor = document.querySelector('meta[name="author"]');

      expect(metaDesc?.getAttribute("content")).toBe("custom desc");
      expect(metaKeywords?.getAttribute("content")).toBe("a,b,c");
      expect(metaAuthor?.getAttribute("content")).toBe("Alice");
    });
  });
});
