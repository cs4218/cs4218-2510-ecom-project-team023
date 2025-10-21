import React from "react";
import { render, fireEvent, waitFor, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../context/auth";
import { CartProvider } from "../context/cart";
import CartPage from "../pages/CartPage"; 
import axios from "axios";
import app from "../../../server"; 
import userModel from "../../../models/userModel"; 
import categoryModel from "../../../models/categoryModel";
import productModel from "../../../models/productModel";
import slugify from "slugify";
import { connectToTestDb, resetTestDb, disconnectFromTestDb } from "../../../config/testdb"
import bcrypt from "bcryptjs";

jest.setTimeout(60000);

jest.mock("../components/Layout", () => ({ children }) => <div data-testid="layout">{children}</div>);
jest.mock("react-icons/ai", () => ({
  AiFillWarning: () => <div data-testid="warning-icon" />,
}));

let server;
let authToken;
let testUser;
let testCategory;
let product1;
let product2;
const tinyBuffer = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');


jest.mock("braintree-web-drop-in-react", () => {
  const React = require("react");
  const requestPaymentMethodMock = jest
    .fn()
    .mockResolvedValue({ nonce: "test-nonce" });

  const DropIn = ({ onInstance }) => {
    const calledRef = React.useRef(false);
    React.useEffect(() => {
      if (calledRef.current) return;
      calledRef.current = true;
      onInstance({ requestPaymentMethod: requestPaymentMethodMock });
    }, [onInstance]);
    return <div data-testid="braintree-dropin">DropIn Component</div>;
  };

  return { __esModule: true, default: DropIn, requestPaymentMethodMock };
});


beforeAll(async () => {
  await connectToTestDb('cartpage-integration-test');

  // Create test user
  const hashedPassword = await bcrypt.hash("adminpassword", 10); 
  testUser = await userModel.create({
    name: 'Test User',
    email: 'testuser@test.com',
    password: hashedPassword,
    phone: '87654321',
    address: '123 Test Street',
    answer: 'red',
    role: 1,
  });

  // Create category for the products
  testCategory = await categoryModel.create({
    name: 'Electronics',
    slug: 'electronics',
  });

  const products = [
    { 
      name: 'Nice Chair', 
      description: 'A comfortable chair', 
      price: 50, 
      category: testCategory._id, 
      quantity: 10,
      slug: slugify('Nice Chair', { lower: true, strict: true })
    },
    { 
      name: 'Fancy Table', 
      description: 'A beautiful table', 
      price: 150, 
      category: testCategory._id, 
      quantity: 5,
      slug: slugify('Fancy Table', { lower: true, strict: true })
    }
  ];

  const createdProducts = await productModel.insertMany(products);
  product1 = createdProducts[0];
  product2 = createdProducts[1];

  const PORT = 8089;
  server = app.listen(PORT);
  axios.defaults.baseURL = `http://localhost:${PORT}`;
});

afterAll(async () => {
  await resetTestDb();
  await disconnectFromTestDb();
  await new Promise((res) => setTimeout(res, 50));
  await new Promise((resolve) => server.close(resolve));
});

const renderCartPage = async (cartItems = [], authenticatedUser = null) => {
  // Mock login request
  const response = await axios.post("/api/v1/auth/login", {
    email: testUser.email,
    password: "adminpassword"
  });

  authToken = response.data.token;

  // Setup localStorage with cart
  if (cartItems.length > 0) {
    localStorage.setItem('cart', JSON.stringify(cartItems));
  }

  // Setup auth in localStorage if user is authenticated
  if (authenticatedUser) {
    localStorage.setItem('auth', JSON.stringify({
      user: authenticatedUser,
      token: authToken
    }));
  }

  const { act: domAct } = require("react-dom/test-utils");
  const act = React.act || domAct;

  let utils;
  await act(async () => {
    utils = render(
      <MemoryRouter>
        <AuthProvider>
          <CartProvider>
            <CartPage />
          </CartProvider>
        </AuthProvider>
      </MemoryRouter>
    );
  });

  return utils;
};

describe('CartPage Integration Tests', () => {
  describe('Auth Context Integration', () => {
    test("should display guest message when user is not logged in", async () => {
      await renderCartPage([], null);

      // Check for guest message using data-testid="cart_user"
      expect(await screen.findByTestId("cart_user")).toHaveTextContent("Hello Guest");
      
      // Check for empty cart message using data-testid="cart_description"
      expect(await screen.findByTestId("cart_description")).toHaveTextContent("Your Cart Is Empty");

      // Check total price message using data-testid="total_price"
      expect(await screen.findByTestId("total_price")).toHaveTextContent("Total : $0.00");
    });

    test("should display user details when user is logged in", async () => {
      await renderCartPage([], testUser);
      
      // Check for user greeting using data-testid="cart_user"
      expect(await screen.findByTestId("cart_user")).toHaveTextContent(`Hello ${testUser.name}`);
      
      // Check if cart is empty using data-testid="cart_description"
      expect(await screen.findByTestId("cart_description")).toHaveTextContent("Your Cart Is Empty");
      
      // Check total price using data-testid="total_price"
      expect(await screen.findByTestId("total_price")).toHaveTextContent("Total : $0.00");
    });
  });

  describe('Cart Context Integration Test', () => {
    test("should display products in the cart when added", async () => {
      const cartItems = [
        {
          _id: product1._id.toString(),
          name: product1.name,
          price: product1.price,
          description: product1.description,
          quantity: product1.quantity,
        },
        {
          _id: product2._id.toString(),
          name: product2.name,
          price: product2.price,
          description: product2.description,
          quantity: product2.quantity,
        },
      ];

      await renderCartPage(cartItems, testUser);

      // Retrieve product elements using data-testid attributes
      const product1Name = await screen.findByTestId(`${product1._id}-name`);
      const product1Price = await screen.findByTestId(`${product1._id}-price`);

      const product2Name = await screen.findByTestId(`${product2._id}-name`);
      const product2Price = await screen.findByTestId(`${product2._id}-price`);

      // Check that the product names are displayed correctly
      expect(product1Name).toHaveTextContent(product1.name);
      expect(product2Name).toHaveTextContent(product2.name);

      // Check that the product prices are displayed correctly
      expect(product1Price).toHaveTextContent(`Price : ${product1.price}`);
      expect(product2Price).toHaveTextContent(`Price : ${product2.price}`);
    });
  });

  describe("Local Storage Integration Test", () => {
    test("should save items in localStorage when products are added to the cart", async () => {
      const cartItems = [
        {
          _id: product1._id.toString(),
          name: product1.name,
          price: product1.price,
          description: product1.description,
          quantity: product1.quantity,
        },
        {
          _id: product2._id.toString(),
          name: product2.name,
          price: product2.price,
          description: product2.description,
          quantity: product2.quantity,
        },
      ];

      // Render the cart page with the given cart items
      await renderCartPage(cartItems, testUser);

      // Verify if localStorage contains the correct cart items
      const storedCart = JSON.parse(localStorage.getItem('cart'));
      expect(storedCart).toHaveLength(2);
      expect(storedCart[0]._id).toBe(product1._id.toString());
      expect(storedCart[1]._id).toBe(product2._id.toString());
    });

    test("should remove item from localStorage when it's removed from the cart", async () => {
      const cartItems = [
        {
          _id: product1._id.toString(),
          name: product1.name,
          price: product1.price,
          description: product1.description,
          quantity: product1.quantity,
        },
      ];

      // Render the cart page with one item
      await renderCartPage(cartItems, testUser);

      // Ensure product is in localStorage initially
      let storedCart = JSON.parse(localStorage.getItem('cart'));
      expect(storedCart).toHaveLength(1);
      expect(storedCart[0]._id).toBe(product1._id.toString());

      // Simulate removal of product from cart
      const removeButton = screen.getByTestId(`${product1._id}-remove-cart`);
      fireEvent.click(removeButton);

      // Verify localStorage is updated and the cart is empty
      storedCart = JSON.parse(localStorage.getItem('cart'));
      expect(storedCart).toHaveLength(0);
      expect(screen.getByText("Your Cart Is Empty")).toBeInTheDocument();
    });

    test("should retain cart items in localStorage after page reload", async () => {
      const cartItems = [
        {
          _id: product1._id.toString(),
          name: product1.name,
          price: product1.price,
          description: product1.description,
          quantity: product1.quantity,
        },
      ];

      // Render the cart page and set the cart items in localStorage
      await renderCartPage(cartItems, testUser);
      const storedCart = JSON.parse(localStorage.getItem('cart'));
      expect(storedCart).toHaveLength(1);
      expect(storedCart[0]._id).toBe(product1._id.toString());

      // Reload the page
      await renderCartPage(cartItems, testUser);

      // Verify that cart items are still in localStorage after the reload
      const reloadStoredCart = JSON.parse(localStorage.getItem('cart'));
      expect(reloadStoredCart).toHaveLength(1);
      expect(reloadStoredCart[0]._id).toBe(product1._id.toString());
    });
    })
});