import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import axios from "axios";
import toast from "react-hot-toast";
import CartPage from "./CartPage";
import { act } from 'react-dom/test-utils';

// --- Mocks Setup ---

// 1. Mock useNavigate
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

// 2. Mock Contexts (State is controlled outside to allow dynamic setting per test)
const mockSetAuth = jest.fn();
const mockSetCart = jest.fn();
let mockAuth = { user: null, token: null };
let mockCart = [];

jest.mock("../context/auth", () => ({
  useAuth: () => [mockAuth, mockSetAuth],
}));
jest.mock("../context/cart", () => ({
  useCart: () => [mockCart, mockSetCart],
}));

// 3. Mock Layout and Icons
jest.mock("./../components/Layout", () => ({ children }) => <div data-testid="layout">{children}</div>);
jest.mock("react-icons/ai", () => ({
  AiFillWarning: () => <div data-testid="warning-icon" />,
}));
jest.mock("../styles/CartStyles.css", () => ({}));

// 4. Mock DropIn component and Braintree Instance
let mockInstance = {
    requestPaymentMethod: jest.fn().mockResolvedValue({ nonce: 'mock-nonce' })
};
// Removed external 'let DropInMock;' declaration
jest.mock("braintree-web-drop-in-react", () => {
    // FIX: Require React inside the mock factory to avoid ReferenceError
    const React = require('react');

    // FIX: Define DropInMock using const inside the factory to resolve "Invalid variable access"
    const DropInMock = ({ options, onInstance }) => {
        // Automatically call onInstance with our mock instance to simulate successful load
        React.useEffect(() => {
            // Note: We delay calling this slightly to match the async nature of the component's state updates
            setTimeout(() => onInstance(mockInstance), 0);
        }, [onInstance]);
        return <div data-testid="braintree-dropin" />;
    };
    return { __esModule: true, default: DropInMock };
});


// 5. Mock external dependencies
jest.mock("axios");
jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { success: jest.fn() },
  success: jest.fn(),
}));

const localStorageMock = (function () {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    removeItem: jest.fn((key) => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; }),

    // CRITICAL FIX: Wrap setItem in jest.fn()
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});


// Test Data
const MOCK_CART = [
  { _id: "p1", name: "Laptop", price: 1500, description: "Powerful laptop" },
  { _id: "p2", name: "Mouse", price: 25, description: "Wireless mouse" },
];
const MOCK_TOTAL_PRICE_STRING = "$1,525.00";
const MOCK_CLIENT_TOKEN = "test-client-token";

describe("CartPage", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorageMock.clear();
        mockNavigate.mockClear();
        mockInstance.requestPaymentMethod.mockResolvedValue({ nonce: 'mock-nonce' });

        // Reset initial auth/cart state to default for a fresh start
        mockAuth = { user: null, token: null };
        mockCart = [];

        // Mock getToken success for all tests unless overridden
        axios.get.mockImplementation((url) => {
            if (url === "/api/v1/product/braintree/token") {
            return Promise.resolve({ data: { clientToken: MOCK_CLIENT_TOKEN } });
            }
            if (url.startsWith("/api/v1/product/product-photo/")) {
            // Mock to prevent console errors if images try to load
            return Promise.resolve({ data: 'mock-image-data' });
            }
            return Promise.reject(new Error(`Unexpected GET call to: ${url}`));
        });
        axios.post.mockClear();
    });


    test("renders authenticated user name and correctly calculates total price", async () => {
        mockAuth = { user: { name: "John Doe", address: "123 Main St" }, token: "123" };
        mockCart = MOCK_CART;
        render(<CartPage />);

        // Wait for the greeting to update and token to be fetched
        await waitFor(() => expect(screen.getByText("Hello John Doe")).toBeInTheDocument());

        expect(screen.getByText(`You Have ${MOCK_CART.length} items in your cart`)).toBeInTheDocument();

        // Check total price calculation
        expect(screen.getByText(`Total : ${MOCK_TOTAL_PRICE_STRING}`)).toBeInTheDocument();
    });

    test("removes item from cart state and localStorage when Remove button is clicked", async () => {
        mockAuth = { user: { name: "User", address: "addr" }, token: "123" };
        mockCart = [...MOCK_CART]; // Use a copy
        localStorageMock.setItem("cart", JSON.stringify(MOCK_CART));

        // Destructure rerender function from the initial render
        const { rerender } = render(<CartPage />);

        // Wait for the specific data-testid to ensure the item card is rendered
        const removeButtonElement = await screen.findByTestId("p1-remove-cart"); 

        // Click the remove button
        fireEvent.click(removeButtonElement); // Using fireEvent as requested

        const remainingCart = [MOCK_CART[1]]; // Should only contain Mouse

        // 1. Verify state update attempt (synchronous call to mock function)
        // The call happens immediately after the click.
        expect(mockSetCart).toHaveBeenCalledWith(remainingCart); 

        // 2. CRITICAL: Manually update the global mock state since mockSetCart doesn't do it.
        mockCart = remainingCart;

        // 3. Force the component to re-render using the updated mockCart value
        rerender(<CartPage />); 

        // 4. Check localStorage update
        expect(localStorageMock.getItem("cart")).toEqual(JSON.stringify(remainingCart));

        // 5. Now, wait for the UI to reflect the new state (Laptop text should be gone)
        await waitFor(() => {
            expect(screen.queryByText(/laptop/i)).not.toBeInTheDocument();
        });

        // 6. Check remaining item
        expect(screen.getByText(/Wireless mouse/i)).toBeInTheDocument();
    });
    test("renders current address and Update Address button when token and address exist", async () => {
      // Arrange: Mock an authenticated user with an address
      mockAuth = { user: { name: "John Doe", address: "123 Main St, Apt 4" }, token: "123" };
      mockCart = MOCK_CART;
      
      render(<CartPage />);

      // Wait for the component to settle (and token fetch to resolve)
      await screen.findByText("Current Address"); 

      // Assert 1: Current address is displayed
      expect(screen.getByText("123 Main St, Apt 4")).toBeInTheDocument();
      
      // Assert 2: "Update Address" button is visible
      const updateBtn = screen.getByRole("button", { name: /Update Address/i });
      expect(updateBtn).toBeInTheDocument();

      // Act: Click the button
      fireEvent.click(updateBtn);
      
      // Assert 3: User is redirected to the profile dashboard
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard/user/profile");
    });
    test("correctly renders all items in the cart with name, description snippet, and price", async () => {
        mockAuth = { user: { name: "Test User", address: "123 Test Ave" }, token: "abc" };
        mockCart = MOCK_CART; // MOCK_CART contains Laptop (1500) and Mouse (25)
        render(<CartPage />);

        // Wait for the component to stabilize and ensure items are present
        await waitFor(() => {
            expect(screen.getByText("Laptop")).toBeInTheDocument();
            expect(screen.getByText("Mouse")).toBeInTheDocument();
        });

        // Check Laptop details
        expect(screen.getByText("Powerful laptop")).toBeInTheDocument();
        expect(screen.getByText("Price : 1500")).toBeInTheDocument();
        
        // Check Mouse details
        expect(screen.getByText("Wireless mouse")).toBeInTheDocument();
        expect(screen.getByText("Price : 25")).toBeInTheDocument();

        // Check for the correct number of 'Remove' buttons
        const removeButtons = screen.getAllByRole('button', { name: 'Remove' });
        expect(removeButtons).toHaveLength(2);
    });

test("handlePayment success processes payment, clears cart/localStorage, navigates, and shows success toast", async () => {
    mockAuth = { user: { name: "User", address: "addr" }, token: "123" };
    mockCart = MOCK_CART;
    localStorageMock.setItem("cart", JSON.stringify(MOCK_CART));

    // Mock API success for payment
    axios.post.mockResolvedValue({ data: { ok: true } });

    render(<CartPage />);

    await waitFor(() => {
        expect(screen.getByRole("button", { name: "Make Payment" })).not.toBeDisabled();
    });

    const paymentButton = screen.getByRole("button", { name: "Make Payment" });

    // Wrap the fireEvent click and async actions inside act to ensure it is properly awaited
    await act(async () => {
        fireEvent.click(paymentButton);
    });
    // Wait for async payment flow to complete
    await waitFor(() => {
        // 2. Verify Braintree method requested
        expect(mockInstance.requestPaymentMethod).toHaveBeenCalledTimes(1);
        
        // 3. Verify payment API called
        expect(axios.post).toHaveBeenCalledWith("/api/v1/product/braintree/payment", {
            nonce: 'mock-nonce',
            cart: MOCK_CART,
        });

        // 4. Verify cart/localStorage clear
        expect(localStorageMock.getItem("cart")).toBeNull();
        expect(mockSetCart).toHaveBeenCalledWith([]);
        
        // 5. Verify navigation and success toast
        expect(mockNavigate).toHaveBeenCalledWith("/dashboard/user/orders");
        expect(toast.success).toHaveBeenCalledWith("Payment Completed Successfully ");
    });

    // 6. Verify loading state is gone
    expect(screen.queryByRole("button", { name: "Processing ...." })).toBeNull();
});

  

    test("Make Payment button is disabled if user address is missing", async () => {
        // Auth token and cart present, but address is null
        mockAuth = { user: { name: "User", address: null }, token: "123" }; 
        mockCart = MOCK_CART;
        render(<CartPage />);

        // Wait for clientToken to resolve and component to fully render DropIn
        await waitFor(() => {
            const paymentButton = screen.getByRole("button", { name: "Make Payment" });
            expect(paymentButton).toBeDisabled();
            expect(screen.getByRole("button", { name: "Update Address" })).toBeInTheDocument();
        });
        });

        test("shows login prompt button when cart has items but user is not logged in", async () => {
        mockAuth = { user: null, token: null };
        mockCart = MOCK_CART;
        render(<CartPage />);

        await waitFor(() => {
            expect(screen.getByText(/please login to checkout/i)).toBeInTheDocument();
        });

        const loginButton = screen.getByRole("button", { name: /Plase Login to checkout/i });

        fireEvent.click(loginButton);
        // Verifies navigation to login page with state to redirect back to cart
        expect(mockNavigate).toHaveBeenCalledWith("/login", { state: "/cart" });
    });

    test("handlePayment failure logs error and resets loading state", async () => {
        const originalConsoleLog = console.log;
        let consoleLogCalls = [];

        console.log = (error) => {
            consoleLogCalls.push(error);
        };

        mockAuth = { user: { name: "User", address: "addr" }, token: "123" };
        mockCart = MOCK_CART;

        const mockError = new Error("Payment API failed");
        axios.post.mockRejectedValue(mockError);

        render(<CartPage />);

        await waitFor(() => {
            expect(screen.getByRole("button", { name: "Make Payment" })).not.toBeDisabled();
        });

        const paymentButton = screen.getByRole("button", { name: "Make Payment" });
            // Wrap the fireEvent click and async actions inside act to ensure it is properly awaited
        await act(async () => {
            fireEvent.click(paymentButton);
        });

        await waitFor(() => {
            // paymentButton = screen.getByTestId("make-payment-btn");
            expect(paymentButton).toHaveTextContent("Make Payment");
            
            expect(consoleLogCalls).toHaveLength(1);
            expect(consoleLogCalls[0]).toEqual(expect.objectContaining({
                message: "Payment API failed"
            }));
        });

        console.log = originalConsoleLog;
        // ----------------------------------
    });
    test("totalPrice catches runtime error and logs to console when price is not number", async () => {
      // Arrange
      const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
      
      // Set up a cart item with an invalid price to force a runtime error
      mockCart = [
        { _id: "p1", price: 100, description: "product-1"},
        { _id: "p2", price: "invalid-price", description: "invalid-item"}, // This will cause the error: total + item.price
      ];
      
      // Act: Render the component, which calls totalPrice()
      await render(<CartPage />);
      
      // The error happens synchronously during the first render.
      // We wait to ensure the component has processed the initial data.
      await waitFor(() => {
        // Assert 1: The console.log should have been called
        expect(logSpy).toHaveBeenCalled();

        // Assert 2: Check that the "Total" area doesn't display the correct total 
        // (it should be empty or show a non-formatted total due to the error/return void)
        expect(screen.queryByText(/Total : \$/)).not.toBeInTheDocument();
      });
      
      // Cleanup
      logSpy.mockRestore();
    });
    test("totalPrice throws an error if price is undefined", async () => {
      // Arrange
      const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
      
      // Set up a cart item with an invalid price to force a runtime error
      mockCart = [
        { _id: "p1", price: undefined, description: "product-1"},
        { _id: "p2", price: "invalid-price", description: "invalid-item"}, // This will cause the error: total + item.price
      ];
      
      // Act: Render the component, which calls totalPrice()
      await render(<CartPage />);
      
      // The error happens synchronously during the first render.
      // We wait to ensure the component has processed the initial data.
      await waitFor(() => {
        // Assert 1: The console.log should have been called
        expect(logSpy).toHaveBeenCalled();

        // Assert 2: Check that the "Total" area doesn't display the correct total 
        // (it should be empty or show a non-formatted total due to the error/return void)
        expect(screen.queryByText(/Total : \$/)).not.toBeInTheDocument();
      });
      
      // Cleanup
      logSpy.mockRestore();
    });
    test("getToken logs error to console when Braintree API fetch fails", async () => {
      // Arrange 1: Spy on console.log
      const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

      // Arrange 2: Mock axios.get for the token endpoint to reject
      const mockError = new Error("Braintree token API unavailable");

      // Ensure only the specific token endpoint fails, others can still resolve if needed.
      axios.get.mockImplementation((url) => {
      if (url === "/api/v1/product/braintree/token") {
        return Promise.reject(mockError);
      }
      // Mock the product photo endpoint if the cart is not empty
      if (url.startsWith("/api/v1/product/product-photo/")) {
        return Promise.resolve({ data: 'mock-image-data' });
      }
      return Promise.resolve({ data: {} }); 
      });

      // Arrange 3: Set up a user and cart to ensure getToken is called by useEffect
      mockAuth = { user: { name: "User" }, token: "123" };
      mockCart = MOCK_CART;

      // Act: Render the component. The useEffect hook calls getToken() on mount.
      render(<CartPage />);

      // Assert: Wait for the asynchronous catch block to be hit and check console.log
      await waitFor(() => {
      // Check that the error object was logged
      expect(logSpy).toHaveBeenCalledWith(mockError);
      });

      // Assert: Verify that setClientToken was NOT called (it shouldn't be set on error)
      // (You don't have setClientToken mocked, but checking the log is sufficient)

      // Cleanup
      logSpy.mockRestore();
    });
    test("Update Address button redirects to the user profile dashboard", async () => {
      // Scenario 1: User is logged in and HAS an address.
      mockAuth = { user: { name: "User", address: "123 Test Ave" }, token: "123" };
      mockCart = MOCK_CART;
      
      const { rerender } = render(<CartPage />);

      // Wait for the button to appear in the 'address is present' block
      const updateBtn1 = await screen.findByRole("button", { name: /Update Address/i });

      // Act 1: Click the first instance of the button
      fireEvent.click(updateBtn1);
      
      // Assert 1: Navigation called for profile
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard/user/profile");

      // Clear mock for the next scenario
      mockNavigate.mockClear();

      // Scenario 2: User is logged in but DOES NOT have an address.
      mockAuth = { user: { name: "User", address: null }, token: "123" };
      
      // Rerender the component with the new state
      rerender(<CartPage />);

      // Wait for the button to appear in the 'address is missing' block
      const updateBtn2 = await screen.findByRole("button", { name: /Update Address/i });

      // Act 2: Click the second instance of the button
      fireEvent.click(updateBtn2);
      
      // Assert 2: Navigation called for profile again
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard/user/profile");
  });
  test("removeCartItem logs error to console when a runtime error occurs", async () => {
    // Arrange 1: Spy on console.log
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    // Arrange 2: Set up a functional mock cart
    mockAuth = { user: { name: "User" }, token: "123" };
    mockCart = MOCK_CART; // MOCK_CART = [{ _id: "p1", ... }, { _id: "p2", ... }]

    // Arrange 3: Temporarily override Array.prototype.splice to throw an error.
    // We use jest.spyOn and mockImplementation to control the standard function.
    const spliceSpy = jest.spyOn(Array.prototype, 'splice');
    const mockError = new Error("Mocked Splice Failure");

    // The first time splice is called (in removeCartItem), throw an error.
    spliceSpy.mockImplementationOnce(() => {
    throw mockError;
    });

    render(<CartPage />);

    // Wait for the component to stabilize and elements to be present
    const removeButtonElement = await screen.findByTestId("p1-remove-cart");

    // Act: Click the remove button, which calls removeCartItem
    fireEvent.click(removeButtonElement);

    // Assert: Check that the error was caught and logged to the console
    await waitFor(() => {
    expect(logSpy).toHaveBeenCalledWith(mockError);
    });

    // Assert: Verify that setCart and localStorage.setItem were NOT called 
    // after the failure (the function should exit early due to the catch block).
    expect(mockSetCart).not.toHaveBeenCalled();
    expect(localStorage.setItem).not.toHaveBeenCalled();

    // Cleanup: Restore the original Array.prototype.splice function
    spliceSpy.mockRestore();
    logSpy.mockRestore();
  });
});
