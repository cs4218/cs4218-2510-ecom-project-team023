/** @jest-environment jsdom */
import '@testing-library/jest-dom';

import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  render,
  screen,
  within,
  waitFor,
  fireEvent,
} from '@testing-library/react';

import CreateCategory from './CreateCategory';

// ---- Mocks ----
jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));
import axios from 'axios';

jest.mock('react-hot-toast', () => {
  const api = { success: jest.fn(), error: jest.fn() };
  return { __esModule: true, default: api, success: api.success, error: api.error };
});
import toast from 'react-hot-toast';

jest.mock('../../components/Layout', () => ({
  __esModule: true,
  default: ({ children }) => <div data-testid="layout">{children}</div>,
}));

jest.mock('../../components/AdminMenu', () => ({
  __esModule: true,
  default: () => <div data-testid="admin-menu">AdminMenu</div>,
}));

// Mock just Modal from antd; keep others default if they’re ever imported.
jest.mock('antd', () => {
  const actual = jest.requireActual('antd');
  const Modal = ({ visible, open, onCancel, children }) => {
    const isOpen = (open ?? visible) ? true : false;
    return (
      <div data-testid="modal" data-open={isOpen ? 'true' : 'false'}>
        {isOpen ? (
          <>
            <button aria-label="close-modal" type="button" onClick={onCancel} />
            {children}
          </>
        ) : (
          <button aria-label="close-modal" style={{ display: 'none' }} type="button" onClick={onCancel} />
        )}
      </div>
    );
  };
  return { ...actual, Modal };
});

// ---- Small helpers ----
const table = () => screen.getByRole('table');
const listRows = () => within(table()).getAllByRole('row');
// Find <tr> that contains a given name text
const getRowByName = (name) => {
  const cell = within(table()).getByText(name);
  return cell.closest('tr');
};

// ---- Tests ----
describe('CreateCategory (integration-ish with mocked HTTP)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads categories, creates one, updates it in modal, then deletes it', async () => {
    // API responses in the exact order the component will call them:
    // 1) initial load (useEffect)
    const initial = {
      success: true,
      category: [
        { _id: 'a', name: 'Books' },
        { _id: 'b', name: 'Electronics' },
      ],
    };
    // 2) after create (component re-fetches)
    const afterCreate = {
      success: true,
      category: [
        ...initial.category,
        { _id: 'c', name: 'Toys' },
      ],
    };
    // 3) after update (component re-fetches)
    const afterUpdate = {
      success: true,
      category: [
        { _id: 'a', name: 'Books' },
        { _id: 'b', name: 'Electronics' },
        { _id: 'c', name: 'Kids Toys' },
      ],
    };
    // 4) after delete (component re-fetches)
    const afterDelete = initial;

    axios.get
      .mockResolvedValueOnce({ data: initial })      // initial useEffect
      .mockResolvedValueOnce({ data: afterCreate })  // after create
      .mockResolvedValueOnce({ data: afterUpdate })  // after update
      .mockResolvedValueOnce({ data: afterDelete }); // after delete

    axios.post.mockResolvedValue({ data: { success: true } });
    axios.put.mockResolvedValue({ data: { success: true } });
    axios.delete.mockResolvedValue({ data: { success: true } });

    render(
      <MemoryRouter>
        <CreateCategory />
      </MemoryRouter>
    );

    // Wait for initial list (fixes act warnings from useEffect -> setCategories)
    await screen.findByText('Books');
    await screen.findByText('Electronics');

    // --- Create ---
    const input = screen.getByPlaceholderText('Enter new category');
    fireEvent.change(input, { target: { value: 'Toys' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Toys is created');
    });
    // Toys should appear after refetch
    await screen.findByText('Toys');

    // --- Update (open modal, change to Kids Toys, submit) ---
    const toysRow = getRowByName('Toys');
    fireEvent.click(within(toysRow).getByRole('button', { name: /edit/i }));
    const modal = screen.getByTestId('modal');
    await waitFor(() => {
      expect(modal).toHaveAttribute('data-open', 'true');
    });

    const modalInput = within(modal).getByPlaceholderText('Enter new category');
    // overwrite (don’t append) to avoid “ToysKids Toys” messages
    fireEvent.change(modalInput, { target: { value: 'Kids Toys' } });

    const modalSubmit = within(modal).getByRole('button', { name: /submit/i });
    fireEvent.click(modalSubmit);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Kids Toys is updated');
      expect(modal).toHaveAttribute('data-open', 'false');
    });

    // Kids Toys should be present now
    await screen.findByText('Kids Toys');

    // --- Delete ---
    const kidsRow = getRowByName('Kids Toys');
    fireEvent.click(within(kidsRow).getByRole('button', { name: /delete/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('category is deleted');
      expect(screen.queryByText('Kids Toys')).not.toBeInTheDocument();
    });

    // Remaining rows still there
    expect(getRowByName('Books')).toBeInTheDocument();
    expect(getRowByName('Electronics')).toBeInTheDocument();

    // sanity: table structure
    expect(listRows().length).toBe(3); // header + 2 data rows
  });

  it('negative: create fails shows error toast and does not change table', async () => {
    const initial = {
      success: true,
      category: [
        { _id: 'a', name: 'Books' },
        { _id: 'b', name: 'Electronics' },
      ],
    };

    axios.get.mockResolvedValueOnce({ data: initial }); // initial load
    axios.post.mockResolvedValue({ data: { success: false, message: 'Duplicate name' } });

    render(
      <MemoryRouter>
        <CreateCategory />
      </MemoryRouter>
    );

    await screen.findByText('Books');
    await screen.findByText('Electronics');

    const input = screen.getByPlaceholderText('Enter new category');
    fireEvent.change(input, { target: { value: 'Books' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Duplicate name');
    });

    // Still only the original 2 rows in tbody
    expect(getRowByName('Books')).toBeInTheDocument();
    expect(getRowByName('Electronics')).toBeInTheDocument();
    expect(screen.queryByText('Toys')).not.toBeInTheDocument();
  });
});
