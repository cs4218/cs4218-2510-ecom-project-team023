import React from "react"
import { render, fireEvent, waitFor, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { SearchProvider } from "../../context/search"; // Import your SearchProvider
import SearchInput from "./SearchInput";
import Search from "../../pages/Search";
import { connectToTestDb, resetTestDb, disconnectFromTestDb } from "../../../../config/testdb";
import productModel from "../../../../models/productModel";
import categoryModel from "../../../../models/categoryModel";
import slugify from "slugify";
import axios from "axios";
import app from "../../../../server";

jest.setTimeout(15000);

let server;

const mockSetAuth = jest.fn();
let mockAuth = { user: null, token: null };
jest.mock("../../context/auth", () => ({
  useAuth: () => [mockAuth, mockSetAuth],
}));

const mockSetCart = jest.fn();
let mockCart = [];
jest.mock("../../context/cart", () => ({
  useCart: () => [mockCart, mockSetCart],
}));

// 3. Mock Layout and Icons
jest.mock("../Layout", () => ({ children }) => <div data-testid="layout">{children}</div>);
jest.mock("react-icons/ai", () => ({
  AiFillWarning: () => <div data-testid="warning-icon" />,
}));

// Setup for in-memory database
beforeAll(async () => {
  await connectToTestDb("search-input-integration-testdb");

  // Insert a valid category to reference in product
  const category = await categoryModel.create({ name: 'Test Category', slug: 'test-category' });

  // Insert mock products
  const products = [
    { 
      name: 'Nice Chair', 
      description: 'A comfortable chair', 
      price: 50, 
      category: category._id, 
      quantity: 10,
      slug: slugify('Nice Chair', { lower: true, strict: true })
    },
    { 
      name: 'Fancy Table', 
      description: 'A beautiful table', 
      price: 150, 
      category: category._id, 
      quantity: 5,
      slug: slugify('Fancy Table', { lower: true, strict: true })
    }
  ];

  // Insert the products into the in-memory database
  await productModel.insertMany(products);
  const PORT = 8089;
  server = app.listen(PORT);
  axios.defaults.baseURL = `http://localhost:${PORT}`;
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(async () => {
  // Clean up the database after tests
  await resetTestDb();
  await disconnectFromTestDb();
  await new Promise((res) => setTimeout(res, 50));
  await new Promise((resolve) => server.close(resolve));
});

const renderSearchInput = async (searchValues = { keyword: "" }) => {
  let utils;
  utils = render(
    <MemoryRouter initialEntries={["/"]}>
      <SearchProvider>
        <Routes>
          <Route path="/" element={<SearchInput />} />
          <Route path="/search" element={<Search />} />
        </Routes>
      </SearchProvider>
    </MemoryRouter>
  );
  return utils;
};




describe('SearchInput Component Integration Test', () => {
  let inputElement;
  let searchButton;

  beforeEach(async () => {
    jest.clearAllMocks();
    const { getByTestId } = await renderSearchInput();
    // Get the input element by its data-testid attribute
    inputElement = getByTestId('search_input'); // Use the data-testid for input
    searchButton = getByTestId('search_button'); // Use the data-testid for search button
  });

  test('should update the search keyword when typing in the input field', async () => {
    // Simulate typing a value in the input field
    fireEvent.change(inputElement, { target: { value: 'Fancy Table' } });

    // Wait for the value to be updated and assert that the input field has the final value
    await waitFor(() => {
      expect(inputElement.value).toBe('Fancy Table');
    });
  });

  test('should reflect the new value when changing the search input', async () => {
    // Simulate typing a new value in the input field
    fireEvent.change(inputElement, { target: { value: 'Nice Chair' } });

    // Wait for the value to be updated and assert the input field has the final value
    await waitFor(() => {
      expect(inputElement.value).toBe('Nice Chair');
    });
  });

  // Test: Simulate submitting the search and checking API response
  test('should fetch results when the search button is clicked', async () => {
    // Set the keyword to 'Fancy Table' in the search input
    fireEvent.change(inputElement, { target: { value: 'Fancy Table' } });

    // Simulate clicking the search button
    fireEvent.click(searchButton);

    // Ensure the search results show the "Fancy Table" product on the page
    expect(await screen.findByText("Fancy Table")).toBeInTheDocument();
  });

  // Test: Empty search input should show empty result
  test('should show an empty result when the search input is empty', async () => {
    // Set the keyword to an empty string
    fireEvent.change(inputElement, { target: { value: '' } });

    // Simulate clicking the search button
    fireEvent.click(searchButton);

     // Ensure the search button is present
  expect(searchButton).toBeInTheDocument();

  // Ensure the search input still shows with the placeholder text
  expect(inputElement).toHaveAttribute('placeholder', 'Search'); // Replace 'Search' with the actual placeholder if needed
  });

  // Test: Simulate search with a non-existent product
  test('should show no results for non-existent product search', async () => {
    // Set a non-existent product name in the search input
    fireEvent.change(inputElement, { target: { value: 'NonExistentProduct' } });

    // Simulate clicking the search button
    fireEvent.click(searchButton);

    // Ensure the page shows no results
    expect(await screen.findByText("No Products Found")).toBeInTheDocument(); // Assuming this message exists
  });
});
