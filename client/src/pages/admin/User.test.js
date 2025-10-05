import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import Users from './Users'; // ADJUST THIS PATH
import toast from 'react-hot-toast'; // <--- Ensure this is present

// Mock axios entirely for API testing
jest.mock('axios');

// Mock the react-hot-toast dependency
jest.mock('react-hot-toast', () => ({
  error: jest.fn(),
}));

// --- Mock Data Setup ---
const mockUsersPage1 = {
  success: true,
  message: 'Paginated users list fetched successfully',
  users: [
    { _id: 'u1', name: 'Alice Admin', email: 'alice@example.com', phone: '111', role: 1, createdAt: '2025-01-01' },
    { _id: 'u2', name: 'Bob User', email: 'bob@example.com', phone: '222', role: 0, createdAt: '2025-01-02' },
    // Only two users for brevity, but totalUsers is 25
  ],
  currentPage: 1,
  totalPages: 3,
  totalUsers: 25,
  limit: 10,
};

const mockUsersPage3 = {
  ...mockUsersPage1,
  users: [
    { _id: 'u21', name: 'Zoe Last', email: 'zoe@example.com', phone: '999', role: 0, createdAt: '2025-01-21' },
    { _id: 'u22', name: 'Yara Penult', email: 'yara@example.com', phone: '888', role: 0, createdAt: '2025-01-22' },
  ],
  currentPage: 3,
};

// Mock components
jest.mock('../../components/AdminMenu', () => () => <div data-testid="admin-menu" />);
jest.mock('../../components/Layout', () => ({ children, title }) => (
  <div data-testid="layout" title={title}>
    {children}
  </div>
));

describe('Users Component - API and Pagination Testing', () => {

  beforeEach(() => {
    axios.get.mockClear();
  });

  // 1. Initial Load and Loading State Test
  test('1. Renders loading state initially', () => {
    axios.get.mockImplementationOnce(() => new Promise(() => {})); 
    render(<Users />);
    
    expect(screen.getByText(/loading users.../i)).toBeInTheDocument();
  });

  // 2. Successful Data Fetch and Display Test
  test('2. Fetches and displays user data on successful load (Page 1)', async () => {
    axios.get.mockResolvedValueOnce({ data: mockUsersPage1 });
    render(<Users />);

    await waitFor(() => {
      expect(screen.getByText(/All Users \(25\)/i)).toBeInTheDocument();
      expect(screen.getByText('Alice Admin')).toBeInTheDocument();
      expect(screen.getByText(/Page 1 of 3/i)).toBeInTheDocument();
    });

    expect(axios.get).toHaveBeenCalledWith('/api/v1/auth/users?page=1&limit=10');
  });

  // 3. Pagination Navigation Test
  test('3. Allows navigation to the next page and correctly updates display', async () => {
    // Mock 1: Initial load (Page 1)
    axios.get.mockResolvedValueOnce({ data: mockUsersPage1 });
    
    // Mock 2: Load after clicking "Next" (Page 3 mock, to save a step)
    axios.get.mockResolvedValueOnce({ data: mockUsersPage3 }); 
      
    render(<Users />);

    // Wait for Page 1 load
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeInTheDocument());
    
    const nextButton = screen.getByTestId('disable_btn');
    fireEvent.click(nextButton);

    // Wait for the component to re-render with Page 3 data
    await waitFor(() => {
      // Check that the new page data is displayed
      expect(screen.getByText('Zoe Last')).toBeInTheDocument();
      // Check the new page status
      expect(screen.getByText(/Page 3 of 3/i)).toBeInTheDocument();
    });

    // Check the API was called for the next page
    expect(axios.get).toHaveBeenCalledWith('/api/v1/auth/users?page=2&limit=10'); // Next page is 2 from current state of 1
  });

  // 4. Boundary Condition Testing (Disabling Buttons) - The fully corrected test
  test('4. Disables pagination buttons at boundaries using data-testid', async () => {
    // Mock 1: Initial load (Page 1)
    axios.get.mockResolvedValueOnce({ data: mockUsersPage1 });
    render(<Users />);

    // 1. Check Boundary Condition 1 (Page 1)
    await waitFor(() => {
      const prevButton = screen.getByRole('button', { name: /Previous/i });
      const nextButton = screen.getByTestId('disable_btn'); 

      expect(prevButton).toBeDisabled();
      expect(nextButton).toBeEnabled();
    });
    
    // Mock 2: Simulate loading the last page (Page 3)
    axios.get.mockResolvedValueOnce({ data: mockUsersPage3 });

    // 2. Click the "Next" button to trigger the fetch for Page 2 (which loads mock Page 3)
    // We use getByRole for the click action as it's the accessible name
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));

    // 3. Check Boundary Condition 2 (Page 3)
    await waitFor(() => {
      // ASSERT: Ensure the last page has rendered
      expect(screen.getByText('Zoe Last')).toBeInTheDocument(); 
      
      const prevButton = screen.getByRole('button', { name: /Previous/i });
      const nextButton = screen.getByTestId('disable_btn');
      
      // ASSERT: Next button should now be disabled
      expect(nextButton).toBeDisabled();
      // ASSERT: Previous button should be enabled
      expect(prevButton).toBeEnabled();
    });
  });
  
  // 5. Displays specific error toast when API returns success: false
  test('5. Displays specific error toast when API returns success: false', async () => {
    // Mock the API to RESOLVE with a failure response (explicit API logic error)
    const mockFailureResponse = {
      success: false,
      message: 'Authentication failed for the user list.',
      users: [],
    };
    axios.get.mockResolvedValueOnce({ data: mockFailureResponse });
    render(<Users />);

    // Wait for the successful resolution and state update
    await waitFor(() => {
      // ASSERT 1: Check that the error toast was called with the specific message
      expect(toast.error).toHaveBeenCalledWith(
        mockFailureResponse.message
      );
      
      // ASSERT 2: Ensure the loading state is cleared
      expect(screen.queryByText(/Loading users.../i)).not.toBeInTheDocument();
    });
    
    // Final check
    expect(screen.queryByText('Alice Admin')).not.toBeInTheDocument();
    expect(toast.error).toHaveBeenCalled(); 
  });
  
  // 6. Test Network/Catch Failure (Covers 'catch' block, line 32)
  test('6. Displays generic error toast and clears loading state when network fetch fails', async () => {
    // Mock the API to REJECT (network error or server crash)
    axios.get.mockRejectedValueOnce(new Error('Network Error'));
    render(<Users />);

    // Wait for the catch and finally blocks to complete
    await waitFor(() => {
      // ASSERT 1: Check that the generic error toast was called (Covers line 32)
      expect(toast.error).toHaveBeenCalledWith(
        "Something went wrong while fetching users."
      );
      
      // ASSERT 2: Ensure the loading state is cleared
      expect(screen.queryByText(/Loading users.../i)).not.toBeInTheDocument();
    });
    
    // Final check
    expect(screen.queryByText('Alice Admin')).not.toBeInTheDocument();
    // Use .toHaveBeenCalled() as the count can be inconsistent in Jest
    expect(toast.error).toHaveBeenCalled(); 
  });
});
