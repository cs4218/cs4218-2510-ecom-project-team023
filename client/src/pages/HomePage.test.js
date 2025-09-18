import React from "react";

import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
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
  beforeEach(() => {
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
  });

  it('should render without crashing and show categories', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<HomePage />} />
        </Routes>
      </MemoryRouter>
    );
    // Wait for category-filter container to be in the document
    await waitFor(() => {
        expect(screen.getByTestId('category-filter')).toBeInTheDocument();
    });

    // Wait for category-1 to appear
    await waitFor(() => {
        expect(screen.getByTestId('category-1')).toBeInTheDocument();
    });

    // Wait for category-2 to appear
    await waitFor(() => {
        expect(screen.getByTestId('category-2')).toBeInTheDocument();
    });
  });

    it('should render without crashing and show price filters', async () => {
        render(
            <MemoryRouter initialEntries={['/']}>
            <Routes>
                <Route path="/" element={<HomePage />} />
            </Routes>
            </MemoryRouter>
        );
        // Wait for category-filter container to be in the document
        await waitFor(() => {
            expect(screen.getByTestId('price-filter')).toBeInTheDocument();
        });
    });


//   it('should render products correctly', async () => {
//     render(
//       <MemoryRouter initialEntries={['/']}>
//         <Routes>
//           <Route path="/" element={<HomePage />} />
//         </Routes>
//       </MemoryRouter>
//     );

//     // Wait for the products to be rendered
//     await waitFor(() => {
//       expect(screen.getByText('Product 1')).toBeInTheDocument();
//       expect(screen.getByText('Product 2')).toBeInTheDocument();
//     });
//   });

//   it('should load more products when Load More button is clicked', async () => {
//     axios.get.mockResolvedValueOnce({
//       data: {
//         total: 5, // Simulate total of 5 products
//         products: [
//           { _id: '3', name: 'Product 3', price: 300, slug: 'product-3' },
//           { _id: '4', name: 'Product 4', price: 400, slug: 'product-4' },
//         ],
//       },
//     });

//     render(
//       <MemoryRouter initialEntries={['/']}>
//         <Routes>
//           <Route path="/" element={<HomePage />} />
//         </Routes>
//       </MemoryRouter>
//     );

//     // Wait for initial products
//     await waitFor(() => {
//       expect(screen.getByText('Product 1')).toBeInTheDocument();
//       expect(screen.getByText('Product 2')).toBeInTheDocument();
//     });

//     // Click Load More button inside `act()`
//     await act(async () => {
//       fireEvent.click(screen.getByText('Loadmore'));
//     });

//     // Wait for more products to load and check if they are rendered
//     await waitFor(() => {
//       expect(axios.get).toHaveBeenCalledTimes(2); // Ensure axios is called again
//       expect(screen.getByText('Product 3')).toBeInTheDocument();
//       expect(screen.getByText('Product 4')).toBeInTheDocument();
//     });
//   });

//   it('should add product to the cart', async () => {
//     const setCart = jest.fn(); // Mock setCart function

//     render(
//       <MemoryRouter initialEntries={['/']}>
//         <Routes>
//           <Route path="/" element={<HomePage />} />
//         </Routes>
//       </MemoryRouter>
//     );

//     // Simulate clicking the ADD TO CART button for Product 1
//     fireEvent.click(screen.getAllByText('ADD TO CART')[0]);

//     // Ensure the cart is updated (calling setCart)
//     expect(setCart).toHaveBeenCalledWith([{ _id: '1', name: 'Product 1', price: 100, slug: 'product-1' }]);

//     // Ensure toast success message is shown
//     expect(require('react-hot-toast').toast.success).toHaveBeenCalledWith('Item Added to cart');
//   });
});