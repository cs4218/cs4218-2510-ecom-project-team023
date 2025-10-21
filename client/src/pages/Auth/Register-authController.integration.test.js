import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import toast from "react-hot-toast";
import axios from "axios";

import {
  connectToTestDb,
  disconnectFromTestDb,
  resetTestDb,
} from "../../../../config/testdb.js";
import app from "../../../../server.js";
import userModel from "../../../../models/userModel.js";
import Register from "../../pages/Auth/Register";

jest.mock("../../components/Layout", () => ({ children }) => (
  <div data-testid="layout">{children}</div>
));

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

beforeAll(async () => {
  await connectToTestDb("register-int-tests");
});

afterAll(async () => {
  await disconnectFromTestDb();
});

describe("Register page integration tests with backend authController", () => {
  let server;
  let port;
  let axiosPostSpy;

  beforeEach(async () => {
    await resetTestDb();
    server = app.listen(7459); // use a separate port for register tests
    port = server.address().port;
    axios.defaults.baseURL = `http://localhost:${port}`;
    axiosPostSpy = jest.spyOn(axios, "post");
    jest.clearAllMocks();
  });

  afterEach(async () => {
    axiosPostSpy.mockRestore();
    await new Promise((res) => setTimeout(res, 50));
    await new Promise((resolve) => server.close(resolve));
  });

  const setup = () =>
    render(
      <MemoryRouter initialEntries={["/register"]}>
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    );

  test("should register a new user successfully when given valid details", async () => {
    setup();

    fireEvent.change(screen.getByPlaceholderText("Enter Your Name"), {
      target: { value: "New User" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Email"), {
      target: { value: "newuser@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Password"), {
      target: { value: "strongpass" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Phone Number"), {
      target: { value: "91234567" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Address"), {
      target: { value: "123 Test Street" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your DOB"), {
      target: { value: "2000-01-01" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("What is Your Favorite Sports?"),
      { target: { value: "Football" } }
    );

    fireEvent.click(screen.getByText("REGISTER"));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "Registered successfully, please login"
      )
    );
    expect(screen.getByText("Login Page")).toBeInTheDocument();
    expect(axiosPostSpy).toHaveBeenCalledTimes(1);
    expect(axiosPostSpy).toHaveBeenCalledWith(
      "/api/v1/auth/register",
      expect.objectContaining({
        name: "New User",
        email: "newuser@example.com",
        password: "strongpass",
        phone: "91234567",
        address: "123 Test Street",
        DOB: "2000-01-01",
        answer: "Football",
      })
    );

    // verify user is created in the database
    const user = await userModel.findOne({ email: "newuser@example.com" });
    expect(user).not.toBeNull();
    expect(user.name).toBe("New User");
  });

  test("should show an error toast message when email already exists", async () => {
    await userModel.create({
      name: "Existing User",
      email: "duplicate@example.com",
      password: "hashedpass",
      phone: "99998888",
      address: "Old Street",
      DOB: "1999-01-01",
      answer: "Football",
    });

    setup();

    fireEvent.change(screen.getByPlaceholderText("Enter Your Name"), {
      target: { value: "Another User" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Email"), {
      target: { value: "duplicate@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Password"), {
      target: { value: "strongpass" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Phone Number"), {
      target: { value: "90000000" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Address"), {
      target: { value: "New Street" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your DOB"), {
      target: { value: "2000-05-05" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("What is Your Favorite Sports?"),
      { target: { value: "Basketball" } }
    );

    fireEvent.click(screen.getByText("REGISTER"));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "User already registered, please login"
      )
    );
    expect(axiosPostSpy).toHaveBeenCalledTimes(1);
  });

  test("should show an error toast message when password is too short", async () => {
    setup();

    fireEvent.change(screen.getByPlaceholderText("Enter Your Name"), {
      target: { value: "Short Pass User" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Email"), {
      target: { value: "short@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Password"), {
      target: { value: "123" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Phone Number"), {
      target: { value: "98765432" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Address"), {
      target: { value: "Short Street" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your DOB"), {
      target: { value: "2000-01-01" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("What is Your Favorite Sports?"),
      { target: { value: "Tennis" } }
    );

    fireEvent.click(screen.getByText("REGISTER"));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Password must be at least 6 characters long"
      )
    );
    expect(axiosPostSpy).toHaveBeenCalledTimes(1);
  });

  test("should fail gracefully with error toast message if there is database error", async () => {
    setup();

    // Original Approach: Simulate database failure by closing the test database connection
    // await disconnectFromTestDb();
    // This approach might cause problems for subsequent tests, so we use jest.spyOn to mock database failure instead
    jest
      .spyOn(userModel, "findOne")
      .mockRejectedValueOnce(new Error("Database error"));

    fireEvent.change(screen.getByPlaceholderText("Enter Your Name"), {
      target: { value: "New User" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Email"), {
      target: { value: "newuser@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Password"), {
      target: { value: "strongpass" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Phone Number"), {
      target: { value: "91234567" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Address"), {
      target: { value: "123 Test Street" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your DOB"), {
      target: { value: "2000-01-01" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("What is Your Favorite Sports?"),
      { target: { value: "Football" } }
    );
    fireEvent.click(screen.getByText("REGISTER"));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Something went wrong")
    );
    expect(axiosPostSpy).toHaveBeenCalledTimes(1);
  });

  test("should not register if required fields are missing", async () => {
    setup();

    fireEvent.change(screen.getByPlaceholderText("Enter Your Name"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Email"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Password"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Phone Number"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Address"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your DOB"), {
      target: { value: "" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("What is Your Favorite Sports?"),
      { target: { value: "" } }
    );
    fireEvent.click(screen.getByText("REGISTER"));

    const name = screen.getByPlaceholderText("Enter Your Name");
    const email = screen.getByPlaceholderText("Enter Your Email");
    const password = screen.getByPlaceholderText("Enter Your Password");
    const phone = screen.getByPlaceholderText("Enter Your Phone Number");
    const address = screen.getByPlaceholderText("Enter Your Address");
    const dob = screen.getByPlaceholderText("Enter Your DOB");
    const answer = screen.getByPlaceholderText("What is Your Favorite Sports?");
    expect(name.validity.valid).toBe(false); // HTML5 required attribute prevents submission
    expect(email.validity.valid).toBe(false);
    expect(password.validity.valid).toBe(false);
    expect(phone.validity.valid).toBe(false);
    expect(address.validity.valid).toBe(false);
    expect(dob.validity.valid).toBe(false);
    expect(answer.validity.valid).toBe(false);
    // ensure we are still on the register page
    expect(screen.getByText("REGISTER FORM")).toBeInTheDocument();
    expect(axiosPostSpy).not.toHaveBeenCalled();
  });
});
