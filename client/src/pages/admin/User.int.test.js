import React from "react";
import { render, fireEvent, waitFor, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { SearchProvider } from "../../context/search";
import { AuthProvider } from "../../context/auth"; // Assuming this is where your AuthContext is
import { connectToTestDb, resetTestDb, disconnectFromTestDb } from "../../../../config/testdb";
import Users from "./Users"
import axios from "axios";
import app from "../../../../server"; // Assuming this is your app import
import userModel from "../../../../models/userModel"; // Assuming this is the User model
import bcrypt from "bcryptjs";

jest.setTimeout(15000);

const mockSetCart = jest.fn();
let mockCart = [];
jest.mock("../../context/cart", () => ({
  useCart: () => [mockCart, mockSetCart],
}));

jest.mock("../../components/Layout", () => ({ children }) => <div data-testid="layout">{children}</div>);
jest.mock("react-icons/ai", () => ({
  AiFillWarning: () => <div data-testid="warning-icon" />,
}));

let server;

// Admin credentials
const adminEmail = "admin@example.com";
const adminPassword = "adminpassword";

// Create 10 normal users (for pagination testing)
const users = [];
// Setup for in-memory database
beforeAll(async () => {
  await connectToTestDb("admin-user-integration-testdb");

  // Insert mock users into the in-memory database
  const hashedPassword = await bcrypt.hash(adminPassword, 10); // Hashing the password
  const adminUser = await userModel.create({
    name: "Admin User",
    email: adminEmail,
    password: hashedPassword,
    role: 1, // Assuming '1' is for admin
    phone: "1234567890",
    address: "Admin Address",
    answer: "admin",
  });

  for (let i = 0; i < 10; i++) {
    users.push({
      name: `User ${i + 1}`,
      email: `user${i + 1}@example.com`,
      password: hashedPassword,
      role: 1, // Normal user
      phone: `098765432${i}`,
      address: `Address ${i + 1}`,
      answer: `answer${i + 1}`,
    });
  }
  const insertedUsers = await userModel.insertMany(users);

  // Update each user with their respective _id after insertion
  insertedUsers.forEach((user, index) => {
    users[index]._id = user._id;
  });
  const PORT = 3030;
  server = app.listen(PORT);
  axios.defaults.baseURL = `http://localhost:${PORT}`;
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(async () => {
  await resetTestDb();
  await disconnectFromTestDb();
  await new Promise((res) => setTimeout(res, 50));
  await new Promise((resolve) => server.close(resolve));
});

const renderAdminPage = async (email, password) => {
  // Mock login request
  const response = await axios.post("/api/v1/auth/login", {
    email,
    password
  });

  axios.defaults.headers.Authorization = `${response.data.token}`;

  // Render the components inside the context
  return render(
    <MemoryRouter initialEntries={["/dashboard/admin/users"]}>
      <AuthProvider>
        <SearchProvider>
          <Routes>
            <Route path="/dashboard/admin/users" element={<Users />} />
          </Routes>
        </SearchProvider>
      </AuthProvider>
    </MemoryRouter>
  );
};

describe("Admin User Integration Test", () => {
    test("should allow access to admin page after login", async () => {
        const { queryByText } = await renderAdminPage(adminEmail, adminPassword);

        // Ensure the loading text disappears
        await waitFor(() => expect(queryByText("Loading users...")).not.toBeInTheDocument());

        // Wait for the element with the data-testid "user_title" to appear
        const userTitle = await screen.findByTestId("user_title");

        // Assert that the text content of the user title is "All Users (11)"
        expect(userTitle).toHaveTextContent("All Users (11)");
    });

    test("should display the correct email, role, and date for each user", async () => {
        const { queryByText } = await renderAdminPage(adminEmail, adminPassword);

        await waitFor(() => expect(queryByText("Loading users...")).not.toBeInTheDocument());

        for (let i = 0; i < 10; i++) {
            const user = users[i]; // Get the user data from the list of users
            const userRow = screen.getByTestId(`user_${user._id}`); // Get the user row by unique id

            // Check if the name, email, and phone are displayed correctly
            expect(userRow.querySelector('[data-testid="name"]')).toHaveTextContent(user.name);
            expect(userRow.querySelector('[data-testid="email"]')).toHaveTextContent(user.email);
            expect(userRow.querySelector('[data-testid="phone"]')).toHaveTextContent(user.phone);

            // Check if the role is displayed correctly
            expect(userRow.querySelector('[data-testid="role"]')).toHaveTextContent(
                user.role === 1 ? "Admin" : "User"
            );
        }
    });

    test("should paginate and load next page of users", async () => {
        const { getByText, getByTestId } = await renderAdminPage(adminEmail, adminPassword);

        // Initially, we should see the first page of 10 users
        expect(await screen.findByText("User 1")).toBeInTheDocument();
        expect(screen.queryByText("Admin User")).toBeNull(); // Admin User should not be shown yet

        // Click "Next" to go to the next page
        fireEvent.click(getByTestId("disable_btn"));

        // Wait for the next set of users to appear (users 11 in this case)
        await waitFor(() => expect(screen.getByText("Admin User")).toBeInTheDocument());
    });

  test("should load users when changing pages", async () => {
    const { getByText, getByTestId } = await renderAdminPage(adminEmail, adminPassword);

    // Initially, we should see the first page of 10 users
    expect(await screen.findByText("User 1")).toBeInTheDocument();
    expect(screen.queryByText("Admin User")).toBeNull(); // Admin User should not be shown yet

    // Change to the second page
    fireEvent.click(getByText("Next »"));

    // Wait for the next set of users to appear
    await waitFor(() => expect(screen.getByText("Admin User")).toBeInTheDocument());
  });
});
