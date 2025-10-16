// playwright.global-setup.ts
import dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });

import { MongoClient, ObjectId } from 'mongodb';

export default async function globalSetup() {
  const uri = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/virtualvault_e2e';
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  const products = db.collection('products');
  const categories = db.collection('categories');

  await Promise.all([products.deleteMany({}), categories.deleteMany({})]);

  const catId = new ObjectId('64a0000000000000000000a1');
  await categories.insertOne({ _id: catId, name: 'Electronics', slug: 'electronics', createdAt: new Date(), updatedAt: new Date() });

  const mainId = new ObjectId('68ecb39346000991f8a1be23');
  const r1Id   = new ObjectId('68ecb39346000991f8a1be26');
  const r2Id   = new ObjectId('68ecb39346000991f8a1be27');

  const base = {
    category: { _id: catId, name: 'Electronics' },
    quantity: 10,
    shipping: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    photo: null,
  };

  await products.insertMany([
    { _id: mainId, name: 'Laptop', slug: 'laptop-123', price: 1500, description: 'High performance laptop', ...base },
    { _id: r1Id,   name: 'Mouse',  slug: 'mouse-abc',   price: 25,   description: 'Ergonomic mouse',        ...base },
    { _id: r2Id,   name: 'Keyboard', slug: 'keyboard-xyz', price: 70, description: 'Mechanical keyboard',  ...base },
  ]);

  await client.close();
}
