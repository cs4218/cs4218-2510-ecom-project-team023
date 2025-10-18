/**
 * @jest-environment node
 */

import mongoose from 'mongoose';
import request from 'supertest';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import app from '../../../../server';
import userModel from '../../../../models/userModel';

dotenv.config();

const mongoUri = process.env.MONGO_URL;
const USERS_PATH = '/api/v1/auth/users';

let admin;
let adminToken;
let regular;
let createdIds = [];

const makeUser = async (over = {}) => {
  const u = await userModel.create({
    name: over.name || `User ${Date.now()}_${Math.random().toString(16).slice(2)}`,
    email: over.email || `u_${Date.now()}_${Math.random().toString(16).slice(2)}@test.local`,
    password: over.password || 'dummy-hash',
    phone: over.phone || '80000000',
    address: over.address || '1 Test Way',
    answer: over.answer || 'blue',
    role: over.role ?? 0
  });
  createdIds.push(u._id);
  return u;
};

beforeAll(async () => {
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
  admin = await makeUser({ role: 1, email: `admin_${Date.now()}@test.local`, name: 'Admin' });
  adminToken = jwt.sign({ _id: admin._id }, process.env.JWT_SECRET || 'testsecret');
  regular = await makeUser({ role: 0, email: `regular_${Date.now()}@test.local`, name: 'Regular' });
  for (let i = 0; i < 23; i++) await makeUser();
});

afterAll(async () => {
  if (createdIds.length) await userModel.deleteMany({ _id: { $in: createdIds } });
  await mongoose.connection.close();
});

describe('getAllUsersController', () => {
  test('401 when not signed in', async () => {
    const res = await request(app).get(USERS_PATH);
    expect(res.status).toBe(401);
  });

  test('401 when signed in as non-admin', async () => {
    const token = jwt.sign({ _id: regular._id }, process.env.JWT_SECRET || 'testsecret');
    const res = await request(app).get(USERS_PATH).set('Authorization', token);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('200 default pagination and field exclusions', async () => {
    const res = await request(app).get(USERS_PATH).set('Authorization', adminToken);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.currentPage).toBe(1);
    expect(res.body.limit).toBe(10);
    expect(Array.isArray(res.body.users)).toBe(true);
    expect(res.body.users.length).toBeLessThanOrEqual(10);
    expect(typeof res.body.totalUsers).toBe('number');
    expect(typeof res.body.totalPages).toBe('number');
    for (const u of res.body.users) {
      expect(u.password).toBeUndefined();
      expect(u.answer).toBeUndefined();
      expect(u.email).toBeTruthy();
      expect(u.name).toBeTruthy();
    }
  });

  test('200 with explicit page and limit', async () => {
    const res = await request(app).get(`${USERS_PATH}?page=2&limit=5`).set('Authorization', adminToken);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.currentPage).toBe(2);
    expect(res.body.limit).toBe(5);
    expect(res.body.users.length).toBeLessThanOrEqual(5);
  });

  test('200 page beyond range returns empty users array', async () => {
    const resAll = await request(app).get(USERS_PATH).set('Authorization', adminToken);
    const total = resAll.body.totalUsers || 0;
    const limit = 10;
    const bigPage = Math.ceil(total / limit) + 5;
    const res = await request(app).get(`${USERS_PATH}?page=${bigPage}&limit=${limit}`).set('Authorization', adminToken);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.users)).toBe(true);
    expect(res.body.users.length).toBe(0);
    expect(res.body.currentPage).toBe(bigPage);
    expect(res.body.limit).toBe(limit);
  });

  test('[EP] non-numeric page and limit fall back to defaults', async () => {
    const res = await request(app).get(`${USERS_PATH}?page=abc&limit=xyz`).set('Authorization', adminToken);
    expect(res.status).toBe(200);
    expect(res.body.currentPage).toBe(1);
    expect(res.body.limit).toBe(10);
  });

  test('[BVA] page=1, limit=1 returns at most one', async () => {
    const res = await request(app).get(`${USERS_PATH}?page=1&limit=1`).set('Authorization', adminToken);
    expect(res.status).toBe(200);
    expect(res.body.currentPage).toBe(1);
    expect(res.body.limit).toBe(1);
    expect(res.body.users.length).toBeLessThanOrEqual(1);
  });

  test('[BVA] limit=0 treated as default', async () => {
    const res = await request(app).get(`${USERS_PATH}?limit=0`).set('Authorization', adminToken);
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(10);
  });

  test('[FSM] unauthenticated → 401, authenticated non-admin → 401, admin → 200', async () => {
    const r1 = await request(app).get(USERS_PATH);
    expect(r1.status).toBe(401);
    const t2 = jwt.sign({ _id: regular._id }, process.env.JWT_SECRET || 'testsecret');
    const r2 = await request(app).get(USERS_PATH).set('Authorization', t2);
    expect(r2.status).toBe(401);
    const r3 = await request(app).get(USERS_PATH).set('Authorization', adminToken);
    expect(r3.status).toBe(200);
    expect(Array.isArray(r3.body.users)).toBe(true);
  });
});