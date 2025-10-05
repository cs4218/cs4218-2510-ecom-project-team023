import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useCart, CartProvider } from './cart'; // Adjust path if necessary

const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// --- Mock Data ---
const mockInitialCart = [
  { _id: 'p1', name: 'Laptop', price: 1200, quantity: 1 },
  { _id: 'p2', name: 'Mouse', price: 25, quantity: 3 },
];

const TestComponent = () => {
  const [cart, setCart] = useCart();

  const handleAddItem = () => {
    // This represents BVA/EP for a valid, non-empty update (Upper Boundary)
    setCart([
      ...cart,
      { _id: 'p3', name: 'Keyboard', price: 80, quantity: 1 },
    ]);
  };

  const handleEmptyCart = () => {
    // This represents BVA/EP for resetting the state to empty (Lower Boundary)
    setCart([]);
  };

  return (
    <div>
      <div data-testid="cart-count">{cart.length}</div>
      <button onClick={handleAddItem} data-testid="add-button">
        Add Item
      </button>
      <button onClick={handleEmptyCart} data-testid="empty-button">
        Empty Cart
      </button>
    </div>
  );
};

// --- Test Suite ---

describe('Cart Context Provider and Hook', () => {

  beforeEach(() => {
    // Clear localStorage mock before each test
    localStorage.clear();
    localStorage.getItem.mockClear();
  });

  // Test Case 1: Initial State (No localStorage data)
  test('1. useCart returns initial empty state when localStorage is empty (BVA/EP: Lower Boundary)', () => {
    // Ensure localStorage.getItem returns null for 'cart'
    localStorage.getItem.mockReturnValue(null);

    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    );

    // Initial state validation (empty cart)
    expect(localStorage.getItem).toHaveBeenCalledWith('cart');
    expect(screen.getByTestId('cart-count')).toHaveTextContent('0');
  });

  // Test Case 2: Initial State (With localStorage data - covers useEffect branch)
  test('2. useCart loads state correctly from localStorage', () => {
    // Mock localStorage to return existing cart data
    localStorage.getItem.mockReturnValue(JSON.stringify(mockInitialCart));

    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    );

    // Assert state loaded from storage (count should be 2)
    expect(localStorage.getItem).toHaveBeenCalledWith('cart');
    expect(screen.getByTestId('cart-count')).toHaveTextContent('2');
  });

  // Test Case 3: Verifying State Update (BVA/EP: Upper Boundary)
  test('3. setCart updates state correctly (adding an item)', () => {
    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    );

    const addButton = screen.getByTestId('add-button');

    // 1. ACT: Click the button to add an item
    act(() => {
      fireEvent.click(addButton);
    });

    // 2. ASSERT: Check that the cart count is now 1
    expect(screen.getByTestId('cart-count')).toHaveTextContent('1');

    // 3. ACT: Click again to add a second item
    act(() => {
      fireEvent.click(addButton);
    });

    // 4. ASSERT: Check that the cart count is now 2
    expect(screen.getByTestId('cart-count')).toHaveTextContent('2');
  });

//   // Test Case 4: Verifying State Reset (BVA/EP: Reset to Lower Boundary)
//   test('4. State can be reset to initial empty values (empty cart)', () => {
//     // Start with a non-empty cart (Mocking loading from storage)
//     localStorage.getItem.mockReturnValue(JSON.stringify(mockInitialCart));

//     render(
//       <CartProvider>
//         <TestComponent />
//       </CartProvider>
//     );

//     // Initial state check
//     expect(screen.getByTestId('cart-count')).toHaveTextContent('2');

//     const emptyButton = screen.getByTestId('empty-button');

//     // ACT: Click the empty button
//     act(() => {
//       fireEvent.click(emptyButton);
//     });

//     // ASSERT: Verify reset (count should be 0)
//     expect(screen.getByTestId('cart-count')).toHaveTextContent('0');
//   });

//   // Test Case 5: Verifying Hook Usage outside Provider (Guard clause)
//   test('5. useCart throws error when used outside CartProvider', () => {
//     // Temporarily override console.error to avoid test output noise from React
//     const consoleErrorMock = jest.spyOn(console, 'error').mockImplementation(() => {});

//     // Hook will throw an error because Context is undefined outside the Provider.
//     expect(() => render(<TestComponent />)).toThrow(
//       /undefined is not iterable/
//     );

//     consoleErrorMock.mockRestore();
//   });
});
