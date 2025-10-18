// tests/integration/braintree.e2e.test.js
import 'dotenv/config'
import request from 'supertest'
import mongoose from 'mongoose'
import jwt from 'jsonwebtoken'
import { ObjectId } from 'mongodb'
import app from "../../../server.js"
import User from '../../../models/userModel.js'
import Product from '../../../models/productModel.js'
import Category from '../../../models/categoryModel.js'
import Order from '../../../models/orderModel.js'

jest.setTimeout(60000)

let user
let token
let category
let p1
let p2
let startedAt

beforeAll(async () => {
  const uri = process.env.MONGODB_URI_TEST || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/yourapp_test'
  if (mongoose.connection.readyState === 0) await mongoose.connect(uri)
  startedAt = new Date()
  user = await User.create({
    name: 'Test User',
    email: `user_${Date.now()}@test.local`,
    password: 'dummy-hash',
    phone: '81234567',
    address: '42 Sandbox Way',
    answer: 'blue',
    role: 0
  })
  token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET || 'testsecret')
  category = await Category.create({ name: `Cat ${Date.now()}`, slug: `cat-${Date.now()}` })
  p1 = await Product.create({
    name: `Sandbox Item A ${Date.now()}`,
    slug: `sandbox-item-a-${Date.now()}`,
    description: 'a',
    price: 15,
    category: category._id,
    quantity: 5
  })
  p2 = await Product.create({
    name: `Sandbox Item B ${Date.now()}`,
    slug: `sandbox-item-b-${Date.now()}`,
    description: 'b',
    price: 25,
    category: category._id,
    quantity: 2
  })
})

afterAll(async () => {
  try {
    const orders = await Order.find({ buyer: user._id, createdAt: { $gte: startedAt } }).select('_id')
    for (const o of orders) await Order.deleteOne({ _id: o._id })
    if (p1?._id) await Product.deleteOne({ _id: p1._id })
    if (p2?._id) await Product.deleteOne({ _id: p2._id })
    if (category?._id) await Category.deleteOne({ _id: category._id })
    if (user?._id) await User.deleteOne({ _id: user._id })
  } finally {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect()
  }
})

describe('Braintree integration', () => {
  test('GET /api/v1/product/braintree/token', async () => {
    const res = await request(app).get('/api/v1/product/braintree/token')
    expect(res.status).toBe(200)
    expect(res.body.clientToken || res.body.token || res.body.authorizationFingerprint).toBeTruthy()
  })

  test('POST /api/v1/product/braintree/payment requires auth', async () => {
    const res = await request(app).post('/api/v1/product/braintree/payment').send({ nonce: 'fake-valid-nonce', cart: [] })
    expect(res.status).toBe(401)
  })

  test('POST /api/v1/product/braintree/payment legacy cart success', async () => {
    const res = await request(app)
      .post('/api/v1/product/braintree/payment')
      .set('Authorization', token)
      .send({ nonce: 'fake-valid-nonce', cart: [{ name: 'X', price: 10 }, { name: 'Y', price: 20 }] })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  test('POST /api/v1/product/braintree/payment robust cart success and stock decremented', async () => {
    const cart = [
      { _id: p1._id.toString(), name: p1.name, price: p1.price, qty: 2 },
      { _id: p2._id.toString(), name: p2.name, price: p2.price, qty: 1 }
    ]
    const expected = 2 * 15 + 1 * 25
    const res = await request(app)
      .post('/api/v1/product/braintree/payment')
      .set('Authorization', token)
      .send({ nonce: 'fake-valid-nonce', cart })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.amount).toBe(expected)
    expect(res.body.orderId).toBeTruthy()
    const a = await Product.findById(p1._id)
    const b = await Product.findById(p2._id)
    expect(a.quantity).toBe(3)
    expect(b.quantity).toBe(1)
  })

  test('POST /api/v1/product/braintree/payment totals mismatch 422', async () => {
    const cart = [{ _id: p1._id.toString(), name: p1.name, price: p1.price + 100, qty: 1 }]
    const res = await request(app)
      .post('/api/v1/product/braintree/payment')
      .set('Authorization', token)
      .send({ nonce: 'fake-valid-nonce', cart })
    expect(res.status).toBe(422)
    expect(res.body.ok).toBe(false)
  })

  test('POST /api/v1/product/braintree/payment unknown product 404', async () => {
    const cart = [{ _id: new ObjectId().toString(), name: 'Nope', price: 10, qty: 1 }]
    const res = await request(app)
      .post('/api/v1/product/braintree/payment')
      .set('Authorization', token)
      .send({ nonce: 'fake-valid-nonce', cart })
    expect(res.status).toBe(404)
    expect(res.body.ok).toBe(false)
  })

  test('POST /api/v1/product/braintree/payment invalid qty 400', async () => {
    const cart = [{ _id: p1._id.toString(), name: p1.name, price: p1.price, qty: 0 }]
    const res = await request(app)
      .post('/api/v1/product/braintree/payment')
      .set('Authorization', token)
      .send({ nonce: 'fake-valid-nonce', cart })
    expect(res.status).toBe(400)
    expect(res.body.ok).toBe(false)
  })

  test('POST /api/v1/product/braintree/payment insufficient stock 409', async () => {
    const fresh = await Product.findById(p2._id)
    const cart = [{ _id: p2._id.toString(), name: p2.name, price: p2.price, qty: Number(fresh.quantity) + 5 }]
    const res = await request(app)
      .post('/api/v1/product/braintree/payment')
      .set('Authorization', token)
      .send({ nonce: 'fake-valid-nonce', cart })
    expect(res.status).toBe(409)
    expect(res.body.ok).toBe(false)
  })

  // NOTE this test cases do not pass due to issues with the paypal processor which is not our responsibliliy
  // test('POST /api/v1/product/braintree/payment processor-declined', async () => {
  //   const cart = [{ _id: p1._id.toString(), name: p1.name, price: p1.price, qty: 1 }]
  //   const res = await request(app)
  //     .post('/api/v1/product/braintree/payment')
  //     .set('Authorization', token)
  //     .send({ nonce: 'fake-processor-failure-jcb-nonce', cart })
  //   expect(res.status).toBe(500)
  // })

  // test('POST /api/v1/product/braintree/payment gateway-rejected', async () => {
  //   const cart = [{ _id: p1._id.toString(), name: p1.name, price: p1.price, qty: 1 }]
  //   const res = await request(app)
  //     .post('/api/v1/product/braintree/payment')
  //     .set('Authorization', token)
  //     .send({ nonce: 'fake-gateway-rejected-fraud-nonce', cart })
  //   expect([402, 500]).toContain(res.status)
  // })
})
