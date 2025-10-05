import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useSearch, SearchProvider } from './search'; // Adjust path if necessary


const TestComponent = () => {
  const [searchValues, setSearchValues] = useSearch();

  const handleUpdate = () => {
    // This represents BVA/EP for a valid, non-empty update (Upper Boundary)
    setSearchValues({
      keyword: 'React Query',
      results: [{ id: 1, name: 'Product A' }, { id: 2, name: 'Product B' }],
    });
  };

  const handleEmptyUpdate = () => {
    // This represents BVA/EP for resetting the state to empty (Lower Boundary)
    setSearchValues({
      keyword: '',
      results: [],
    });
  };

  return (
    <div>
      <div data-testid="keyword-display">{searchValues.keyword}</div>
      <div data-testid="results-count">{searchValues.results.length}</div>
      <button onClick={handleUpdate} data-testid="update-button">
        Update Search
      </button>
      <button onClick={handleEmptyUpdate} data-testid="reset-button">
        Reset Search
      </button>
    </div>
  );
};


describe('Search Context Provider and Hook', () => {

  // Test Case 1: Verifying Initial State (Equivalence Partitioning: Empty/Default)
  test('1. useSearch returns the correct initial state (BVA/EP: Lower Boundary)', () => {
    render(
      <SearchProvider>
        <TestComponent />
      </SearchProvider>
    );

    // Initial state validation
    expect(screen.getByTestId('keyword-display')).toHaveTextContent('');
    expect(screen.getByTestId('results-count')).toHaveTextContent('0');
  });

  // Test Case 2: Verifying State Update (Equivalence Partitioning: Non-Empty)
  test('2. setSearchValues updates state correctly (BVA/EP: Upper Boundary)', () => {
    render(
      <SearchProvider>
        <TestComponent />
      </SearchProvider>
    );

    const updateButton = screen.getByTestId('update-button');

    // 1. ACT: Click the button to trigger the update
    act(() => {
      fireEvent.click(updateButton);
    });

    // 2. ASSERT: Check that the state has been updated to the new, non-empty values
    expect(screen.getByTestId('keyword-display')).toHaveTextContent('React Query');
    expect(screen.getByTestId('results-count')).toHaveTextContent('2');
  });
  
  // Test Case 3: Verifying State Reset (BVA/EP: Reset to Lower Boundary)
  test('3. State can be reset to initial empty values', () => {
    render(
      <SearchProvider>
        <TestComponent />
      </SearchProvider>
    );
    
    const updateButton = screen.getByTestId('update-button');
    const resetButton = screen.getByTestId('reset-button');

    // First, update the state
    act(() => {
      fireEvent.click(updateButton);
    });
    
    // Verify update
    expect(screen.getByTestId('keyword-display')).toHaveTextContent('React Query');

    // Second, reset the state
    act(() => {
      fireEvent.click(resetButton);
    });

    // Verify reset (back to BVA/EP Lower Boundary)
    expect(screen.getByTestId('keyword-display')).toHaveTextContent('');
    expect(screen.getByTestId('results-count')).toHaveTextContent('0');
  });

  // Test Case 4: Verifying Hook Usage (Ensuring no default fallback when not wrapped)
  test('4. useSearch throws error when used outside SearchProvider', () => {
  
    const consoleErrorMock = jest.spyOn(console, 'error').mockImplementation(() => {});
 
    expect(() => render(<TestComponent />)).toThrow(     
      /undefined is not iterable|must be used within a SearchProvider/
    );

    consoleErrorMock.mockRestore();
  });
});
