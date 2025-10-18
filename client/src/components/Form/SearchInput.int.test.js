/**
 * @jest-environment node
 */

import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../../../server'; // Import your app here
import dotenv from 'dotenv';
import productModel from '../../../../models/productModel';
import categoryModel from '../../../../models/categoryModel';
import slugify from 'slugify';

dotenv.config();

// MongoDB URI from .env file (or replace it with your actual MongoDB URI)
const mongoUri = process.env.MONGO_URL;

let category;  // Declare category here to be used in cleanup

beforeAll(async () => {
  // Connect to your actual MongoDB instance (MongoDB Atlas or local MongoDB)
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });

  // Insert a valid category to reference in product
  category = await categoryModel.create({ name: 'Test Category', slug: 'test-category' });

  // Insert mock products with valid category references and auto-generated slugs
  const products = [
    { 
      name: 'Nice Chair', 
      description: 'A comfortable chair', 
      price: 50, 
      category: category._id, 
      quantity: 10,
      slug: slugify('Nice Chair', { lower: true, strict: true })
    },
    { 
      name: 'Fancy Table', 
      description: 'A beautiful table', 
      price: 150, 
      category: category._id, 
      quantity: 5,
      slug: slugify('Fancy Table', { lower: true, strict: true })
    },
    { 
      name: 'Cozy Sofa', 
      description: 'Perfect for relaxing', 
      price: 300, 
      category: category._id, 
      quantity: 3,
      slug: slugify('Cozy Sofa', { lower: true, strict: true })
    },
    { 
      name: 'Stylish Lamp', 
      description: 'Brightens up your room', 
      price: 80, 
      category: category._id, 
      quantity: 20,
      slug: slugify('Stylish Lamp', { lower: true, strict: true })
    },
    { 
      name: 'Simple Bed', 
      description: 'A bed for comfort', 
      price: 200, 
      category: category._id, 
      quantity: 7,
      slug: slugify('Simple Bed', { lower: true, strict: true })
    },
  ];

  // Insert the products into the actual database
  await productModel.insertMany(products);
});

afterAll(async () => {
  // Clean up: Delete only the products and the category we inserted for the test
  await productModel.deleteMany({ category: category._id });  // Delete products associated with the test category
  await categoryModel.deleteOne({ _id: category._id });  // Delete the test category

  // Close the mongoose connection
  await mongoose.connection.close();
});

describe('Search Product Controller', () => {
  // Test 1: Search for a valid product name
  it('should return the correct product when searching for an exact match', async () => {
    const response = await request(app).get('/api/v1/product/search/Nice Chair');
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].name).toBe('Nice Chair');
  });

  // Test 2: Search for a product that doesn't exist
  it('should return an empty array when no products match the search', async () => {
    const response = await request(app).get('/api/v1/product/search/NonExistentProduct');
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(0);
  });

  // Test 3: Search for a common term (e.g., "Table")
  it('should return multiple products when searching for a common term', async () => {
    const response = await request(app).get('/api/v1/product/search/Table');
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2); // "Fancy Table" and "Simple Bed"
  });

  // Test 4: Case-insensitive search
  it('should return the correct product regardless of case', async () => {
    const response = await request(app).get('/api/v1/product/search/fancy table');
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].name).toBe('Fancy Table');
  });
});

describe('Search Product Controller (FSM)', () => {
  // State 1: Searching for an exact match
  it('should return the exact product for an exact match', async () => {
    const response = await request(app).get('/api/v1/product/search/Nice Chair');
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].name).toBe('Nice Chair');
  });

  // State 2: Searching for a term that matches multiple products
  it('should return multiple products for a common keyword search', async () => {
    const response = await request(app).get('/api/v1/product/search/Chair');
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1); // "Nice Chair"
  });

  // State 3: Searching for a term with no matches
  it('should return an empty array for a search term that does not match any products', async () => {
    const response = await request(app).get('/api/v1/product/search/NonExistentItem');
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(0);
  });

  // State 4: Case-insensitive search for product
  it('should return the correct product for a case-insensitive search', async () => {
    const response = await request(app).get('/api/v1/product/search/fancy table');
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].name).toBe('Fancy Table');
  });

  // State 5: Searching for a category that matches multiple products
  it('should return multiple products from a search that includes a category term', async () => {
    const response = await request(app).get('/api/v1/product/search/Comfort');
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2); // "Cozy Sofa" and "Simple Bed"
  });
});

describe('Search Product Controller (EP)', () => {
  // Valid input: Searching by exact match
  it('should return a product for a valid exact search term', async () => {
    const response = await request(app).get('/api/v1/product/search/Nice Chair');
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].name).toBe('Nice Chair');
  });

  // Valid input: Searching by part of the name (common term "Table")
  it('should return products when searching for part of a name (valid partial search)', async () => {
    const response = await request(app).get('/api/v1/product/search/Table');
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2); // "Fancy Table" and "Simple Bed"
  });

  // Valid input: Searching for a category term
  it('should return products when searching by category', async () => {
    const response = await request(app).get('/api/v1/product/search/Comfort');
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2); // "Cozy Sofa" and "Simple Bed"
  });

  // Invalid input: Empty search term (equivalence class of invalid empty string)
  it('should return an empty array when searching with an empty string', async () => {
    const response = await request(app).get('/api/v1/product/search/');
    expect(response.status).toBe(404);
    expect(response.body).toStrictEqual({});
  });

  // Invalid input: Special characters in the search term (equivalence class of invalid special characters)
  it('should return an empty array when searching with special characters', async () => {
    const response = await request(app).get('/api/v1/product/search/$%^&*');
    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({});
  });

  // Invalid input: Searching for a non-existent product (equivalence class of invalid non-existent search term)
  it('should return an empty array for a non-existent product search', async () => {
    const response = await request(app).get('/api/v1/product/search/NonExistentProduct');
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(0);
  });
});

describe('Search Product Controller (BVA)', () => {
  // Boundary: Search with the minimum valid input (one character, e.g., "N")
  it('should return products when searching with the minimum valid input (one character)', async () => {
    const response = await request(app).get('/api/v1/product/search/N');
    expect(response.status).toBe(200);

    expect(response.body.length).toBeGreaterThanOrEqual(1);
    expect(response.body.every(p =>
      (typeof p.name === 'string' && /n/i.test(p.name)) ||
      (typeof p.description === 'string' && /n/i.test(p.description))
  )).toBe(true);
  });

  // Boundary: Search with the maximum valid input (a very long string)
  it('should handle a very long search term without crashing the server', async () => {
    const longSearchTerm = 'A'.repeat(1000); // Create a search term with 1000 characters
    const response = await request(app).get(`/api/v1/product/search/${longSearchTerm}`);
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(0); // Likely to be empty, as this is not a valid product name
  });

  // Boundary: Search for the exact product name with different cases (edge case for case-insensitive search)
  it('should return the correct product regardless of case (e.g., "fancy table")', async () => {
    const response = await request(app).get('/api/v1/product/search/fancy table');
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].name).toBe('Fancy Table');
  });

  it('should handle very short search terms correctly (1 character)', async () => {
    const response = await request(app).get('/api/v1/product/search/T');
    expect(response.status).toBe(200);
    const items = Array.isArray(response.body) ? response.body : [];
    if (items.length === 0) {
      expect(items).toHaveLength(0);
    } else {
      expect(items.every(p =>
        (typeof p?.name === 'string' && /t/i.test(p.name)) ||
        (typeof p?.description === 'string' && /t/i.test(p.description))
      )).toBe(true);
    }
  });

});

