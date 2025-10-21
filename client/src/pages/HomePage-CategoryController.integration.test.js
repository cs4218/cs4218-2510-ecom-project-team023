// Some tests written with help of AI
jest.setTimeout(30000);

import "@testing-library/jest-dom";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, within, waitFor } from "@testing-library/react";
import axios from "axios";

import HomePage from "./HomePage";

// ──────────────────────────
// Real server + real test DB 
// ──────────────────────────
import app from "../../../server.js"; 
import {
  connectToTestDb,
  resetTestDb,
  disconnectFromTestDb,
} from "../../../config/testdb.js";
import mongoose from "mongoose";
import "../../../models/categoryModel.js"; 
import "../../../models/productModel.js";  

let server;
let Category;

const renderHome = () =>
  render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>
  );

// keep DOM clean (no full page chrome)
jest.mock("../components/Layout", () => ({
  __esModule: true,
  default: ({ children }) => <div data-testid="layout">{children}</div>,
}));

// cart provider used by HomePage "ADD TO CART" button — keep it inert
jest.mock("../context/cart", () => ({
  __esModule: true,
  useCart: () => [[], jest.fn()],
}));

// Tame AntD Checkbox/Radio to accessible native inputs
jest.mock("antd", () => {
  const React = require("react");
  const Checkbox = ({ children, onChange, ...rest }) => (
    <label>
      <input
        type="checkbox"
        role="checkbox"
        aria-label={typeof children === "string" ? children : undefined}
        onChange={(e) => onChange?.({ target: { checked: e.target.checked } })}
        {...rest}
      />
      {children}
    </label>
  );
  const Radio = ({ children, ...rest }) => (
    <label>
      <input type="radio" role="radio" {...rest} />
      {children}
    </label>
  );
  const Group = ({ children, onChange }) => <div onChange={onChange}>{children}</div>;
  Radio.Group = Group;
  return { __esModule: true, Checkbox, Radio };
});

beforeAll(async () => {
  // unify all tests on the same in-memory connection style used elsewhere
  process.env.NODE_ENV = "test";
  await connectToTestDb("frontend-homepage-categories");

  // start the real HTTP server and point axios at it
  server = app.listen(0);
  const port = server.address().port;
  axios.defaults.baseURL = `http://localhost:${port}`;

  // obtain compiled model from active connection
  Category = mongoose.model("Category");
});

afterAll(async () => {
  await new Promise((r) => server.close(r));
  await disconnectFromTestDb();
});

beforeEach(async () => {
  await resetTestDb();
  // seed ONLY categories; product endpoints will still work and just return empty sets
  await Category.create([
    { name: "Phones", slug: "phones" },
    { name: "Laptops", slug: "laptops" },
    { name: "Accessories", slug: "accessories" },
  ]);
});

describe("HomePage (categories only, real HTTP + DB)", () => {
  test("renders category checkboxes from /api/v1/category/get-category", async () => {
    renderHome();

    // Wait for categories to appear
    const phones = await screen.findByText("Phones");
    const laptops = await screen.findByText("Laptops");
    const accessories = await screen.findByText("Accessories");

    expect(phones).toBeInTheDocument();
    expect(laptops).toBeInTheDocument();
    expect(accessories).toBeInTheDocument();

    // Ensure they're under the “Filter By Category” block and are accessible checkboxes
    const filterBlock = screen.getByText(/filter by category/i).closest("div");
    const checks = within(filterBlock).getAllByRole("checkbox");
    expect(checks).toHaveLength(3);

    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: /phones/i })).toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: /laptops/i })).toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: /accessories/i })).toBeInTheDocument();
    });
  });
});
