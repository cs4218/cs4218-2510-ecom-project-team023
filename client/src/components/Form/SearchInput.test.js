// this file have been written with the help of AI

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SearchInput from './SearchInput';
import { useSearch } from '../../context/search';
import axios from "axios";

// 1. Mocks
const mockSetValues = jest.fn();
const mockNavigate = jest.fn();
const mockAxiosGet = jest.spyOn(axios, 'get');

// Mock the entire search context module
jest.mock('../../context/search', () => ({
  useSearch: jest.fn(),
}));

// ❗️ FIX: Correctly mock the useNavigate function
jest.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate, // Use useNavigate, not userNavigate
}));

// Helper function to render the component with default mocked state
const renderWithMocks = (initialValue = { keyword: "", results: []}) => {
    useSearch.mockReturnValue([initialValue, mockSetValues]);
    render(<SearchInput />);
}

beforeEach(() => {
    jest.clearAllMocks();
    mockAxiosGet.mockClear(); // Ensure axios mock is clear for each test
});

test('Input displays context keyword and calls setValues on change', () => {
    const initialValues = { keyword: 'initial search', results: [] };
    renderWithMocks(initialValues);

    const input = screen.getByPlaceholderText('Search');
    expect(input).toHaveValue('initial search');

    fireEvent.change(input, { target: { value: 'new search query' } });

    // Expect setValues to be called with the updated keyword
    expect(mockSetValues).toHaveBeenCalledWith({
    keyword: 'new search query',
    results: [],
    });
});

test('Successful search submission updates context and navigates', async () => {
    const keyword = 'test-query';
    const apiData = [{ id: 1, name: 'Product 1' }];
    
    // Set the initial context keyword for the search
    const initialValues = { keyword, results: [] };
    
    // Mock the successful API response
    mockAxiosGet.mockResolvedValueOnce({ data: apiData });

    renderWithMocks(initialValues);

    // Get the search button and click it to submit the form
    const searchButton = screen.getByRole('button', { name: /search/i });
    fireEvent.click(searchButton);

    // Wait for the async API call and subsequent state/navigation updates
    await waitFor(() => {
        // 1. Check if axios was called correctly
        expect(mockAxiosGet).toHaveBeenCalledWith(`/api/v1/product/search/${keyword}`);
        
        // 2. Check if context was updated with results
        expect(mockSetValues).toHaveBeenCalledWith({
            keyword,
            results: apiData, // API data should be set as results
        });

        // 3. Check if navigation occurred
        expect(mockNavigate).toHaveBeenCalledWith('/search');
    });
});

test('Failed search submission logs error and does not navigate', async () => {
    const keyword = 'failing-query';
    const error = new Error('API down');
    
    // Mock the API call to reject
    mockAxiosGet.mockRejectedValueOnce(error);
    
    // Spy on console.log to ensure the error is handled (as per component code)
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    renderWithMocks({ keyword, results: [] });
    
    const form = screen.getByRole('search');
    fireEvent.submit(form);

    await waitFor(() => {
        // Check if the error was logged
        expect(consoleLogSpy).toHaveBeenCalledWith(error);
        
        // Check that context state was NOT updated with results (only called with initial set)
        // Since setValues is called once on every render with initialValues, we check the second call
        expect(mockSetValues).not.toHaveBeenCalledWith(
            expect.objectContaining({ results: expect.anything() })
        );
        
        // Check that navigation did NOT occur
        expect(mockNavigate).not.toHaveBeenCalled();
    });
    
    consoleLogSpy.mockRestore();
});