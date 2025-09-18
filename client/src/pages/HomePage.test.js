import React from "react";

import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { useCart } from "../context/cart";
import HomePage from "./HomePage";
import useCategory from "../hooks/useCategory";
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import axios from "axios";
import '@testing-library/jest-dom/extend-expect';
import { it } from "node:test";
import { Prices } from "../components/Prices";
jest.mock('axios');

// Dummy mocks for the necessary hooks and components
jest.mock('../hooks/useCategory', () => jest.fn(() => [
  { _id: '1', name: 'Category 1' },
  { _id: '2', name: 'Category 2' }
]));

jest.mock('../context/cart', () => ({
  useCart: jest.fn(() => [[], jest.fn()]), // Mocking empty cart
}));

jest.mock('../context/auth', () => ({
  useAuth: jest.fn(() => [null, jest.fn()]), // Mocking logged out user
}));

jest.mock('../context/search', () => ({
    useSearch: jest.fn(() => [{ keyword: '' }, jest.fn()]) // Mock useSearch hook to return null state and a mock function
  }));  


describe('HomePage Initial Render', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    // Mock axios responses
    axios.get.mockResolvedValueOnce({
      data: { total: 5 }, // Mock total count of products
    });

    axios.get.mockResolvedValueOnce({
      data: {
        products: [
          { _id: '1', name: 'Product 1', price: 100, slug: 'product-1', description: "product1" },
          { _id: '2', name: 'Product 2', price: 200, slug: 'product-2', description: "product2"},
        ],
      },
    });
    await render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<HomePage />} />
        </Routes>
      </MemoryRouter>
    );
  });

  // this are kept together because node does not support executing multiple test when waiting for promises
  test('should category filters without error', async () => {
    // Wait for category-filter container to be in the document
    expect(screen.getByTestId('category-filter')).toBeInTheDocument();
    expect(screen.getByTestId('category-1')).toBeInTheDocument();
    expect(screen.getByTestId('category-2')).toBeInTheDocument();
  });

  test('should render price filters without error', async () => {
    expect(screen.getByTestId('price-filter')).toBeInTheDocument();

    for (let i = 0; i < Prices.length; i++) {
      expect(screen.getByTestId(`price-${Prices[i]._id}`)).toBeInTheDocument();
    }
  });
});


describe('HomePage Load More functionality', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    // Mock axios responses
    axios.get.mockResolvedValueOnce({
      data: { total: 5 }, // Mock total count of products
    });

    axios.get.mockResolvedValueOnce({
      data: {
        products: [
          { _id: '1', name: 'Product 1', price: 100, slug: 'product-1', description: "product1" },
          { _id: '2', name: 'Product 2', price: 200, slug: 'product-2', description: "product2" },
        ],
      },
    });

    // Mock the next page response for load more
    axios.get.mockResolvedValueOnce({
      data: {
        products: [
          { _id: '3', name: 'Product 3', price: 300, slug: 'product-3', description: "product3" },
          { _id: '4', name: 'Product 4', price: 400, slug: 'product-4', description: "product4" },
        ],
      },
    });

    // Initial render of HomePage
    await render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<HomePage />} />
        </Routes>
      </MemoryRouter>
    );
  });

  test('should render initial products and load more products when button is clicked', async () => {
    // Wait for initial products to be rendered
    await waitFor(() => {
      expect(screen.getByTestId("product-1")).toBeInTheDocument();
      expect(screen.getByTestId("product-2")).toBeInTheDocument();
    });

    // Simulate the "Load More" button click that triggers `useEffect` for next page
    await act(async () => {
      fireEvent.click(screen.getByTestId("btn-load-more"));
    });

    // Wait for the new products to be rendered after the page change
    await waitFor(() => {
      expect(screen.getByText('Product 3')).toBeInTheDocument();
      expect(screen.getByText('Product 4')).toBeInTheDocument();
    });

    /*
      1.
    */
    expect(axios.get).toHaveBeenCalledTimes(3);
  });
});

describe('HomePage Load More functionality with error', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock initial successful responses
    axios.get.mockResolvedValueOnce({
      data: { total: 5 }, // Mock total count of products
    });

    axios.get.mockResolvedValueOnce({
      data: {
        products: [
          { _id: '1', name: 'Product 1', price: 100, slug: 'product-1', description: "product1" },
          { _id: '2', name: 'Product 2', price: 200, slug: 'product-2', description: "product2" },
        ],
      },
    });

    // Mock the next page response to simulate an error (when "Load More" is clicked)
    axios.get.mockRejectedValueOnce(new Error('Failed to fetch products'));

    // Initial render of HomePage
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<HomePage />} />
        </Routes>
      </MemoryRouter>
    );
  });

  test('should show error message when Load More button is clicked and axios throws an error', async () => {
    // Wait for initial products to be rendered
    await waitFor(() => {
      expect(screen.getByTestId("product-1")).toBeInTheDocument();
      expect(screen.getByTestId("product-2")).toBeInTheDocument();
    });

    // Simulate the "Load More" button click that triggers the error
    await act(async () => {
      fireEvent.click(screen.getByTestId("btn-load-more"));
    });

    // Wait for the error message to be displayed
    await waitFor(() => {
      expect(screen.getByTestId('product-section-error')).toBeInTheDocument(); // Error message should appear with this test ID
    });

    expect(axios.get).toHaveBeenCalledTimes(3);
  });
});



describe('HomePage Checkbox Filter functionality', () => {

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock axios response for the initial product load
    axios.get.mockResolvedValueOnce({
      data: {
        products: [
          { _id: '1', name: 'Product 1', price: 100, slug: 'product-1', description: 'product1' },
          { _id: '2', name: 'Product 2', price: 200, slug: 'product-2', description: 'product2' },
        ],
      },
    });

    // Initial render of HomePage
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<HomePage />} />
        </Routes>
      </MemoryRouter>
    );
  });

  test('should update checked state when checkbox is clicked', async () => {
    // Wait for checkboxes to be rendered
    await waitFor(() => {
      expect(screen.getByTestId('category-1')).toBeInTheDocument();
      expect(screen.getByTestId('category-2')).toBeInTheDocument();
    });

    // Simulate checking Category 1
    fireEvent.click(screen.getByTestId('category-1'));
    
    // Verify if setChecked was called with the correct updated state
    await waitFor(() => {
      expect(screen.getByTestId('category-1')).toBeChecked();  // Category 1 should be checked now
    });

    // Simulate checking Category 2
    fireEvent.click(screen.getByTestId('category-2'));
    
    // Verify if setChecked was called with both Category 1 and Category 2
    await waitFor(() => {
      expect(screen.getByTestId('category-2')).toBeChecked();  // Category 2 should be checked now
    });

    // Simulate unchecking Category 1
    fireEvent.click(screen.getByTestId('category-1'));
    
    // // Verify if setChecked was called with only Category 2
    await waitFor(() => {
      expect(screen.getByTestId('category-1')).not.toBeChecked();  // Category 1 should be unchecked now
    });
  });
});
