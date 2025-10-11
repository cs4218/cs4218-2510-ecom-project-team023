import express from "express";
import {
  brainTreePaymentController,
  braintreeTokenController,
  createProductController,
  deleteProductController,
  getProductController,
  getSingleProductController,
  productCategoryController,
  productCountController,
  productFiltersController,
  productListController,
  productPhotoController,
  realtedProductController,
  searchProductController,
  updateProductController,
} from "../controllers/productController.js";
import { isAdmin, requireSignIn } from "../middlewares/authMiddleware.js";
import formidable from "express-formidable";

const router = express.Router();

// Create product (ADMIN)
router.post(
  "/create-product",
  requireSignIn,
  isAdmin,
  formidable(),
  createProductController
);

// Update product (ADMIN)
router.put(
  "/update-product/:pid",
  requireSignIn,
  isAdmin,
  formidable(),
  updateProductController
);

// Get products (PUBLIC)
router.get("/get-product", getProductController);

// Get single product by slug (PUBLIC)
router.get("/get-product/:slug", getSingleProductController);

// Get product photo (PUBLIC)
router.get("/product-photo/:pid", productPhotoController);

// Delete product (ADMIN)  ⬅️ added isAdmin + requireSignIn
router.delete(
  "/delete-product/:pid",
  requireSignIn,
  isAdmin,
  deleteProductController
);

// Product filters (PUBLIC)
router.post("/product-filters", productFiltersController);

// Product count (PUBLIC)
router.get("/product-count", productCountController);

// Product list by page (PUBLIC)
router.get("/product-list/:page", productListController);

// Search product (PUBLIC)
router.get("/search/:keyword", searchProductController);

// Related product (PUBLIC)
router.get("/related-product/:pid/:cid", realtedProductController);

// Category-wise product (PUBLIC)
router.get("/product-category/:slug", productCategoryController);

// Payments
router.get("/braintree/token", braintreeTokenController); // PUBLIC for client token
router.post("/braintree/payment", requireSignIn, brainTreePaymentController); // user checkout

export default router;
