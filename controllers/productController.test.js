/* list of jest tests written by chatgpt getProductController, getPhotoController, productFiltersController, Braintree tests*/
const fs = require("fs");
const slugify = require("slugify");

// ---------- Mocks ----------
jest.mock("fs", () => ({
  readFileSync: jest.fn(),
}));

jest.mock("dotenv", () => ({
  config: jest.fn(),
}));

jest.mock("slugify", () => (s) =>
  String(s ?? "").trim().toLowerCase().replace(/\s+/g, "-")
);

jest.mock("../models/productModel.js", () => {
  const Model = Object.assign(jest.fn(), {
    find: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    findByIdAndDelete: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    // optional: estimatedDocumentCount may be set per-test
  });
  Model.mockImplementation((doc = {}) => ({
    ...doc,
    photo: {},
    save: jest.fn().mockResolvedValue({ _id: "prod1", ...doc }),
  }));
  return Model;
});

jest.mock("../models/categoryModel.js", () => {
  const Model = Object.assign(jest.fn(), { findOne: jest.fn() });
  Model.mockImplementation((doc = {}) => ({ ...doc }));
  return Model;
});

jest.mock("../models/orderModel.js", () => {
  const Model = Object.assign(jest.fn(), {});
  Model.mockImplementation((doc = {}) => ({
    ...doc,
    save: jest.fn().mockResolvedValue({ _id: "order1", ...doc }),
  }));
  return Model;
});

jest.mock("braintree", () => {
  const BraintreeGateway = jest.fn(() => ({
    clientToken: { generate: jest.fn() },
    transaction: { sale: jest.fn() },
  }));
  return {
    BraintreeGateway,
    Environment: { Sandbox: "Sandbox" },
  };
});

// ---------- Import SUT and mocked deps ----------
const ProductModel = require("../models/productModel.js");
const CategoryModel = require("../models/categoryModel.js");
const OrderModel = require("../models/orderModel.js");
const braintree = require("braintree");

const {
  createProductController,
  getProductController,
  getSingleProductController,
  productPhotoController,
  deleteProductController,
  updateProductController,
  productFiltersController,
  productCountController,
  productListController,
  searchProductController,
  realtedProductController,
  productCategoryController,
  braintreeTokenController,
  brainTreePaymentController,
  getGateway,
  btMocks,
} = require("./productController.js");

// ---------- helpers ----------
const makeRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.send = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.set = jest.fn(() => res);
  return res;
};

// Prefer res.json if used, else res.send — keeps tests robust to controller changes
const pickResponder = (res) => (res.json.mock.calls.length ? res.json : res.send);

const makeQueryChain = (result) => {
  const chain = {
    _calls: {},
    populate: jest.fn(function (...args) {
      chain._calls.populate = args;
      return chain;
    }),
    select: jest.fn(function (...args) {
      chain._calls.select = args;
      return chain;
    }),
    limit: jest.fn(function (...args) {
      chain._calls.limit = args;
      return chain;
    }),
    sort: jest.fn(function (...args) {
      chain._calls.sort = args;
      return chain;
    }),
    skip: jest.fn(function (...args) {
      chain._calls.skip = args;
      return chain;
    }),
    then: (onFulfilled, onRejected) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected) => Promise.resolve(result).catch(onRejected),
  };
  return chain;
};

beforeEach(() => {
  jest.clearAllMocks();
  // reset ProductModel default instance behavior each test
  ProductModel.mockImplementation((doc = {}) => ({
    ...doc,
    photo: {},
    save: jest.fn().mockResolvedValue({ _id: "prod1", ...doc }),
  }));
});

// Valid ObjectIds for tests that should pass ObjectId validation
const OID1 = "507f1f77bcf86cd799439011";
const OID2 = "507f1f77bcf86cd799439012";
const OID3 = "507f1f77bcf86cd799439013";

/* ---------- createProductController ---------- */
describe("createProductController", () => {
  const baseFields = {
    name: " Mac Book Air ",
    description: "Light laptop",
    price: 1234,
    category: "cat123",
    quantity: 9,
    shipping: true,
  };

  test.each([
    ["missing name",        { ...baseFields, name: undefined }, "Name is Required"],
    ["missing description", { ...baseFields, description: undefined }, "Description is Required"],
    ["missing price",       { ...baseFields, price: undefined }, "Price is Required"],
    ["missing category",    { ...baseFields, category: undefined }, "Category is Required"],
    ["missing quantity",    { ...baseFields, quantity: undefined }, "Quantity is Required"],
  ])("400 validation - %s", async (_label, fields, expectedError) => {
    const req = { fields, files: {} };
    const res = makeRes();
    await createProductController(req, res);
    const responder = pickResponder(res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(responder).toHaveBeenCalledWith({ error: expectedError });
    expect(ProductModel).not.toHaveBeenCalled();
  });

  test("400 photo too large", async () => {
    const req = {
      fields: baseFields,
      files: { photo: { size: 1000001, path: "/tmp/p.png", type: "image/png" } },
    };
    const res = makeRes();
    await createProductController(req, res);
    const responder = pickResponder(res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(responder).toHaveBeenCalledWith({
      error: "photo is Required and should be less then 1mb",
    });
  });

  test("201 creates product (with photo) and slugifies name", async () => {
    fs.readFileSync.mockReturnValue(Buffer.from("FAKE_IMAGE"));
    const req = {
      fields: baseFields,
      files: { photo: { size: 100, path: "/tmp/p.png", type: "image/png" } },
    };
    const res = makeRes();

    await createProductController(req, res);

    expect(ProductModel).toHaveBeenCalledWith(expect.objectContaining({
      ...baseFields, slug: "mac-book-air",
    }));
    const instance = ProductModel.mock.results[0].value;
    expect(fs.readFileSync).toHaveBeenCalledWith("/tmp/p.png");
    expect(instance.photo.data).toBeInstanceOf(Buffer);
    expect(instance.photo.contentType).toBe("image/png");
    expect(instance.save).toHaveBeenCalled();
    const responder = pickResponder(res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(responder).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "Product Created Successfully",
        products: expect.objectContaining({ slug: "mac-book-air" }),
      })
    );
  });

  test("500 when save throws", async () => {
    // only for this test
    ProductModel.mockImplementationOnce((doc = {}) => ({
      ...doc,
      photo: {},
      save: jest.fn().mockRejectedValue(new Error("save failed")),
    }));
    const req = { fields: baseFields, files: {} };
    const res = makeRes();
    await createProductController(req, res);
    const responder = pickResponder(res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(responder).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringMatching(/creat|crearing|create/i) })
    );
  });
});

/* ---------- getProductController ---------- */
describe("getProductController", () => {
  test("200 returns list with chained query", async () => {
    const products = [{ _id: "p1" }, { _id: "p2" }];
    const chain = makeQueryChain(products);
    ProductModel.find.mockReturnValue(chain);
    const res = makeRes();
    await getProductController({}, res);
    const responder = pickResponder(res);
    expect(ProductModel.find).toHaveBeenCalledWith({});
    expect(chain.populate).toHaveBeenCalledWith("category");
    expect(chain.select).toHaveBeenCalledWith("-photo");
    expect(chain.limit).toHaveBeenCalledWith(12);
    expect(chain.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(responder).toHaveBeenCalledWith({
      success: true,
      counTotal: products.length,
      message: "ALlProducts ",
      products,
    });
  });

  test("500 when query throws", async () => {
    ProductModel.find.mockImplementation(() => ({
      populate: () => ({
        select: () => ({
          limit: () => ({
            sort: () => Promise.reject(new Error("boom")),
          }),
        }),
      }),
    }));
    const res = makeRes();
    await getProductController({}, res);
    const responder = pickResponder(res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(responder).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringMatching(/get.*products/i) })
    );
  });
});

/* ---------- getSingleProductController ---------- */
describe("getSingleProductController", () => {
  test("200 returns single", async () => {
    const product = { _id: "p1", slug: "mac" };
    const chain = makeQueryChain(product);
    ProductModel.findOne.mockReturnValue(chain);
    const res = makeRes();
    await getSingleProductController({ params: { slug: "mac" } }, res);
    const responder = pickResponder(res);
    expect(ProductModel.findOne).toHaveBeenCalledWith({ slug: "mac" });
    expect(chain.select).toHaveBeenCalledWith("-photo");
    expect(chain.populate).toHaveBeenCalledWith("category");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(responder).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        product,
      })
    );
  });

  test("404 when not found", async () => {
    const chain = makeQueryChain(null);
    ProductModel.findOne.mockReturnValue(chain);
    const res = makeRes();
    await getSingleProductController({ params: { slug: "missing" } }, res);
    const responder = pickResponder(res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(responder).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  test("500 on DB error", async () => {
    const err = new Error("fail");

    ProductModel.findOne.mockReturnValue({
      populate: () => ({ select: () => Promise.reject(err) }),
      select:   () => ({ populate: () => Promise.reject(err) }),
    });

    const res = makeRes();
    await getSingleProductController({ params: { slug: "mac" } }, res);
    const responder = pickResponder(res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(responder).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringMatching(/error.*product|single product/i),
      })
    );
  });
});

/* ---------- productPhotoController ---------- */
describe("productPhotoController", () => {
  test("200 streams photo when present", async () => {
    const product = { photo: { data: Buffer.from("X"), contentType: "image/png" } };
    ProductModel.findById.mockReturnValue({ select: () => Promise.resolve(product) });
    const res = makeRes();
    await productPhotoController({ params: { pid: OID1 } }, res);
    expect(ProductModel.findById).toHaveBeenCalledWith(OID1);
    expect(res.set).toHaveBeenCalledWith("Content-Type", "image/png");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(product.photo.data);
  });

  test("404 JSON when photo missing", async () => {
    ProductModel.findById.mockReturnValue({ select: () => Promise.resolve({ photo: {} }) });
    const res = makeRes();
    await productPhotoController({ params: { pid: OID2 } }, res);
    const responder = pickResponder(res);
    expect(res.set).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(responder).toHaveBeenCalledWith({ success: false, message: "Photo not found" });
  });

  test("400 on malformed ObjectId", async () => {
    const res = makeRes();
    await productPhotoController({ params: { pid: "not-an-objectid" } }, res);
    const responder = pickResponder(res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(responder).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  test("500 on DB error", async () => {
    ProductModel.findById.mockReturnValue({ select: () => Promise.reject(new Error("read err")) });
    const res = makeRes();
    await productPhotoController({ params: { pid: OID3 } }, res);
    const responder = pickResponder(res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(responder).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringMatching(/photo/i) })
    );
  });
});

/* ---------- deleteProductController ---------- */
describe("deleteProductController", () => {
  test("200 deletes by id", async () => {
    ProductModel.findByIdAndDelete.mockReturnValue({
      select: () => Promise.resolve({ _id: "gone" }),
    });
    const res = makeRes();
    await deleteProductController({ params: { pid: "deadbeef" } }, res);
    const responder = pickResponder(res);
    expect(ProductModel.findByIdAndDelete).toHaveBeenCalledWith("deadbeef");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(responder).toHaveBeenCalledWith({
      success: true,
      message: "Product Deleted successfully",
    });
  });

  test("500 on DB error", async () => {
    ProductModel.findByIdAndDelete.mockReturnValue({
      select: () => Promise.reject(new Error("del err")),
    });
    const res = makeRes();
    await deleteProductController({ params: { pid: "x" } }, res);
    const responder = pickResponder(res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(responder).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringMatching(/delet/i) })
    );
  });
});

/* ---------- updateProductController ---------- */
describe("updateProductController", () => {
  const fields = {
    name: " New Name ",
    description: "desc",
    price: 10,
    category: "cat",
    quantity: 1,
    shipping: false,
  };

  test.each([
    ["missing name",        { ...fields, name: undefined }, "Name is Required"],
    ["missing description", { ...fields, description: undefined }, "Description is Required"],
    ["missing price",       { ...fields, price: undefined }, "Price is Required"],
    ["missing category",    { ...fields, category: undefined }, "Category is Required"],
    ["missing quantity",    { ...fields, quantity: undefined }, "Quantity is Required"],
  ])("500 validation - %s", async (_label, badFields, msg) => {
    const req = { fields: badFields, files: {}, params: { pid: "p1" } };
    const res = makeRes();
    await updateProductController(req, res);
    const responder = pickResponder(res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(responder).toHaveBeenCalledWith({ error: msg });
    expect(ProductModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test("500 when photo > 1MB", async () => {
    const req = {
      fields,
      files: { photo: { size: 1000001, path: "/tmp/new.jpg", type: "image/jpeg" } },
      params: { pid: "p1" },
    };
    const res = makeRes();
    await updateProductController(req, res);
    const responder = pickResponder(res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(responder).toHaveBeenCalledWith({
      error: "photo is Required and should be less then 1mb",
    });
  });

  test("201 updates product (with photo) and saves", async () => {
    fs.readFileSync.mockReturnValue(Buffer.from("IMG"));
    const updated = { _id: "p1", photo: {}, save: jest.fn().mockResolvedValue({ _id: "p1" }) };
    ProductModel.findByIdAndUpdate.mockResolvedValue(updated);

    const req = {
      fields,
      files: { photo: { size: 500, path: "/tmp/new.jpg", type: "image/jpeg" } },
      params: { pid: "p1" },
    };
    const res = makeRes();

    await updateProductController(req, res);

    expect(ProductModel.findByIdAndUpdate).toHaveBeenCalledWith(
      "p1", expect.objectContaining({ ...fields, slug: "new-name" }), { new: true }
    );
    expect(fs.readFileSync).toHaveBeenCalledWith("/tmp/new.jpg");
    expect(updated.photo.contentType).toBe("image/jpeg");
    expect(updated.save).toHaveBeenCalled();
    const responder = pickResponder(res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(responder).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "Product Updated Successfully",
        products: expect.objectContaining({ _id: "p1" }),
      })
    );
  });

  test("500 when findByIdAndUpdate throws", async () => {
    ProductModel.findByIdAndUpdate.mockRejectedValue(new Error("upd err"));
    const res = makeRes();
    await updateProductController({ fields, files: {}, params: { pid: "p1" } }, res);
    const responder = pickResponder(res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(responder).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringMatching(/upd|update/i) })
    );
  });

  test("500 when save throws", async () => {
    const updated = { _id: "p1", photo: {}, save: jest.fn().mockRejectedValue(new Error("save err")) };
    ProductModel.findByIdAndUpdate.mockResolvedValue(updated);
    const res = makeRes();
    await updateProductController({ fields, files: {}, params: { pid: "p1" } }, res);
    const responder = pickResponder(res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(responder).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringMatching(/upd|update/i) })
    );
  });

  test("404 when product not found", async () => {
    ProductModel.findByIdAndUpdate.mockResolvedValue(null);
    const res = makeRes();
    await updateProductController(
      { fields: { ...fields }, files: {}, params: { pid: "missing" } },
      res
    );
    const responder = pickResponder(res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(responder).toHaveBeenCalledWith({
      success: false,
      message: "Product not found",
    });
  });

  test("200 OK on success (no photo)", async () => {
    const updated = { _id: "p1", photo: {}, save: jest.fn().mockResolvedValue({ _id: "p1" }) };
    ProductModel.findByIdAndUpdate.mockResolvedValue(updated);
    const res = makeRes();
    await updateProductController(
      {
        fields: {
          name: " Name ",
          description: "D",
          price: 5,
          category: "c",
          quantity: 2,
          shipping: true,
        },
        files: {},
        params: { pid: "p1" },
      },
      res
    );
    const responder = pickResponder(res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(responder).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "Product Updated Successfully",
      })
    );
  });
});

/* ---------- productFiltersController ---------- */
describe("productFiltersController", () => {
  test("200 filters by categories + price range", async () => {
    const products = [{ _id: "f1" }, { _id: "f2" }];
    ProductModel.find.mockResolvedValue(products);
    const res = makeRes();
    await productFiltersController({ body: { checked: ["c1", "c2"], radio: [10, 50] } }, res);
    const responder = pickResponder(res);
    expect(ProductModel.find).toHaveBeenCalledWith({
      category: ["c1", "c2"],
      price: { $gte: 10, $lte: 50 },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(responder).toHaveBeenCalledWith({ success: true, products });
  });

  test("200 with empty filters -> args {}", async () => {
    ProductModel.find.mockResolvedValue([]);
    const res = makeRes();
    await productFiltersController({ body: { checked: [], radio: [] } }, res);
    const responder = pickResponder(res);
    expect(ProductModel.find).toHaveBeenCalledWith({});
    expect(res.status).toHaveBeenCalledWith(200);
    expect(responder).toHaveBeenCalledWith({ success: true, products: [] });
  });

  test("400 on error", async () => {
    ProductModel.find.mockRejectedValueOnce(new Error("filter err"));
    const res = makeRes();
    await expect(
      productFiltersController({ body: { checked: [], radio: [] } }, res)
    ).resolves.toBeUndefined();
    const responder = pickResponder(res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(responder).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringMatching(/filter/i) })
    );
  });
});

/* ---------- productCountController ---------- */
describe("productCountController", () => {
  test("200 returns count (model.estimatedDocumentCount())", async () => {
    ProductModel.estimatedDocumentCount = jest.fn().mockResolvedValue(42);
    const res = makeRes();
    await productCountController({}, res);
    const responder = pickResponder(res);
    expect(ProductModel.estimatedDocumentCount).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(responder).toHaveBeenCalledWith({ success: true, total: 42 });
  });

  test("400 on error", async () => {
    ProductModel.estimatedDocumentCount = jest.fn().mockRejectedValue(new Error("cnt err"));
    const res = makeRes();
    await productCountController({}, res);
    const responder = pickResponder(res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(responder).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringMatching(/count/i) })
    );
  });
});

/* ---------- productListController ---------- */
describe("productListController", () => {
  test("200 paginated list default page=1", async () => {
    const products = [{ _id: "a" }];
    const chain = makeQueryChain(products);
    ProductModel.find.mockReturnValue(chain);
    const res = makeRes();
    await productListController({ params: {} }, res);
    const responder = pickResponder(res);
    expect(chain.select).toHaveBeenCalledWith("-photo");
    expect(chain.skip).toHaveBeenCalledWith(0);
    expect(chain.limit).toHaveBeenCalledWith(6);
    expect(chain.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(responder).toHaveBeenCalledWith({ success: true, products });
  });

  test("200 paginated list page=3 (skip 12)", async () => {
    const chain = makeQueryChain([{ _id: "x" }]);
    ProductModel.find.mockReturnValue(chain);
    const res = makeRes();
    await productListController({ params: { page: "3" } }, res);
    const responder = pickResponder(res);
    expect(chain.skip).toHaveBeenCalledWith(12);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(responder).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  test("400 on error", async () => {
    ProductModel.find.mockReturnValue({
      select: () => ({ skip: () => ({ limit: () => ({ sort: () => Promise.reject(new Error("page err")) }) }) }),
    });
    const res = makeRes();
    await productListController({ params: { page: "2" } }, res);
    const responder = pickResponder(res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(responder).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringMatching(/per page/i) })
    );
  });
});

/* ---------- searchProductController ---------- */
describe("searchProductController", () => {
  test("200 json results for keyword search", async () => {
    const results = [{ _id: "s1" }, { _id: "s2" }];
    ProductModel.find.mockReturnValue({ select: () => Promise.resolve(results) });
    const res = makeRes();
    await searchProductController({ params: { keyword: "lap" } }, res);
    expect(ProductModel.find).toHaveBeenCalledWith({
      $or: [
        { name: { $regex: "lap", $options: "i" } },
        { description: { $regex: "lap", $options: "i" } },
      ],
    });
    expect(res.json).toHaveBeenCalledWith(results);
  });

  test("400 on error", async () => {
    ProductModel.find.mockReturnValue({ select: () => Promise.reject(new Error("search err")) });
    const res = makeRes();
    await searchProductController({ params: { keyword: "x" } }, res);
    const responder = pickResponder(res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(responder).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringMatching(/search/i) })
    );
  });

  // unit test
  test("returns single product on exact name match", async () => {
    const product = [{ _id: "p1", name: "Mac Book Air" }];
    ProductModel.find.mockReturnValue({ select: () => Promise.resolve(product) });
    const res = makeRes();
    await searchProductController({ params: { keyword: "Mac Book Air" } }, res);
    expect(res.json).toHaveBeenCalledWith(product);
  });

  test("returns products regardless of case", async () => {
    const products = [{ _id: "p1" }];
    ProductModel.find.mockReturnValue({ select: () => Promise.resolve(products) });
    const res = makeRes();
    await searchProductController({ params: { keyword: "mAc bOoK" } }, res);
    expect(res.json).toHaveBeenCalledWith(products);
  });

  test("returns empty array for empty keyword", async () => {
    const res = makeRes();
    ProductModel.find.mockReturnValue({ select: () => Promise.resolve([]) });
    await searchProductController({ params: { keyword: "" } }, res);
    expect(res.json).toHaveBeenCalledWith([]);
  });

  test("returns empty array when keyword not found", async () => {
    const res = makeRes();
    ProductModel.find.mockReturnValue({ select: () => Promise.resolve([]) });
    await searchProductController({ params: { keyword: "XYZ123" } }, res);
    expect(res.json).toHaveBeenCalledWith([]);
  });

  test("handles very long keyword without crash", async () => {
    const keyword = "a".repeat(255);
    const products = [{ _id: "p1" }];
    ProductModel.find.mockReturnValue({ select: () => Promise.resolve(products) });
    const res = makeRes();
    await searchProductController({ params: { keyword } }, res);
    expect(res.json).toHaveBeenCalledWith(products);
  });

  test("handles keyword with special regex characters", async () => {
    const keyword = "Laptop$^*";
    const products = [{ _id: "p1" }];
    ProductModel.find.mockReturnValue({ select: () => Promise.resolve(products) });
    const res = makeRes();
    await searchProductController({ params: { keyword } }, res);
    expect(res.json).toHaveBeenCalledWith(products);
  });

  test("handles null keyword gracefully", async () => {
    const res = makeRes();
    ProductModel.find.mockReturnValue({ select: () => Promise.resolve([]) });
    await searchProductController({ params: { keyword: null } }, res);
    expect(res.json).toHaveBeenCalledWith([]);
  });

  test("returns multiple matching products for common keyword", async () => {
    const products = [{ _id: "p1" }, { _id: "p2" }, { _id: "p3" }];
    ProductModel.find.mockReturnValue({ select: () => Promise.resolve(products) });
    const res = makeRes();
    await searchProductController({ params: { keyword: "Laptop" } }, res);
    expect(res.json).toHaveBeenCalledWith(products);
  });

  test("returns empty array for whitespace-only keyword", async () => {
    const res = makeRes();
    ProductModel.find.mockReturnValue({ select: () => Promise.resolve([]) });
    await searchProductController({ params: { keyword: "    " } }, res);
    expect(res.json).toHaveBeenCalledWith([]);
  });

  test("handles large number of matches without crashing", async () => {
    const products = Array.from({ length: 200 }, (_, i) => ({ _id: `p${i}` }));
    ProductModel.find.mockReturnValue({ select: () => Promise.resolve(products) });
    const res = makeRes();
    await searchProductController({ params: { keyword: "Laptop" } }, res);
    expect(res.json).toHaveBeenCalledWith(products);
  });
});

/* ---------- realtedProductController ---------- */
describe("realtedProductController", () => {
  test("200 returns related", async () => {
    const products = [{ _id: "r1" }, { _id: "r2" }];
    const chain = makeQueryChain(products);
    ProductModel.find.mockReturnValue(chain);
    const res = makeRes();
    await realtedProductController({ params: { pid: "p1", cid: "c1" } }, res);
    const responder = pickResponder(res);
    expect(ProductModel.find).toHaveBeenCalledWith({ category: "c1", _id: { $ne: "p1" } });
    expect(chain.select).toHaveBeenCalledWith("-photo");
    expect(chain.limit).toHaveBeenCalledWith(3);
    expect(chain.populate).toHaveBeenCalledWith("category");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(responder).toHaveBeenCalledWith({ success: true, products });
  });

  test("400 on error", async () => {
    ProductModel.find.mockReturnValue({
      select: () => ({ limit: () => ({ populate: () => Promise.reject(new Error("rel err")) }) }),
    });
    const res = makeRes();
    await realtedProductController({ params: { pid: "p1", cid: "c1" } }, res);
    const responder = pickResponder(res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(responder).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringMatching(/related/i) })
    );
  });
});

/* ---------- productCategoryController ---------- */
describe("productCategoryController", () => {
  test("200 returns products by category slug", async () => {
    const category = { _id: "cat1", slug: "laptops" };
    CategoryModel.findOne.mockResolvedValue(category);
    const products = [{ _id: "p1" }];
    const chain = makeQueryChain(products);
    ProductModel.find.mockReturnValue(chain);
    const res = makeRes();
    await productCategoryController({ params: { slug: "laptops" } }, res);
    const responder = pickResponder(res);
    expect(CategoryModel.findOne).toHaveBeenCalledWith({ slug: "laptops" });
    expect(ProductModel.find).toHaveBeenCalledWith({ category });
    expect(chain.populate).toHaveBeenCalledWith("category");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(responder).toHaveBeenCalledWith({ success: true, category, products });
  });

  test("404 when category not found", async () => {
    CategoryModel.findOne.mockResolvedValue(null);
    const res = makeRes();
    await productCategoryController({ params: { slug: "missing" } }, res);
    const responder = pickResponder(res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(responder).toHaveBeenCalledWith({
      success: false,
      message: "Category not found",
    });
  });

  test("400 on error", async () => {
    CategoryModel.findOne.mockRejectedValue(new Error("cat err"));
    const res = makeRes();
    await productCategoryController({ params: { slug: "x" } }, res);
    const responder = pickResponder(res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(responder).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringMatching(/getting products/i) })
    );
  });
});

/* ---------- Braintree token + payment ---------- */
describe("braintreeTokenController", () => {
  test("200 returns token", async () => {
    const res = makeRes();
    const gateway = getGateway();
    gateway.clientToken.generate.mockImplementation((opts, cb) => cb(null, { clientToken: "tok_123" }));
    await braintreeTokenController({}, res);
    expect(gateway.clientToken.generate).toHaveBeenCalledWith({}, expect.any(Function));
    expect(res.send).toHaveBeenCalledWith({ clientToken: "tok_123" });
  });

  test("500 on gateway error", async () => {
    const res = makeRes();
    const gateway = getGateway();
    const err = new Error("bt err");
    gateway.clientToken.generate.mockImplementation((opts, cb) => cb(err, undefined));
    await braintreeTokenController({}, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith(err);
  });
});

describe("brainTreePaymentController", () => {
  test("200 json ok on successful sale; saves order", async () => {
    const res = makeRes();
    const gateway = getGateway();
    gateway.transaction.sale.mockImplementation((payload, cb) => cb(null, { id: "txn1", success: true }));

    const req = { body: { nonce: "nonce", cart: [{ price: 10 }, { price: 2.5 }] }, user: { _id: "user1" } };
    await brainTreePaymentController(req, res);

    expect(gateway.transaction.sale).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 12.5, paymentMethodNonce: "nonce", options: { submitForSettlement: true } }),
      expect.any(Function)
    );
    expect(OrderModel).toHaveBeenCalledWith(
      expect.objectContaining({
        products: [{ price: 10 }, { price: 2.5 }],
        payment: expect.objectContaining({ id: "txn1" }),
        buyer: "user1",
      })
    );
    expect(OrderModel.mock.results[0].value.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  test("500 when sale returns error", async () => {
    const res = makeRes();
    const gateway = getGateway();
    const err = new Error("declined");
    gateway.transaction.sale.mockImplementation((payload, cb) => cb(err, null));
    await brainTreePaymentController({ body: { nonce: "N", cart: [{ price: 1 }] }, user: { _id: "u" } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith(err);
  });

  test("500 when result.success is false", async () => {
    const res = makeRes();
    const { mockBtSale } = btMocks;
    mockBtSale.mockImplementation((payload, cb) => cb(null, { success: false, message: "Declined" }));
    await brainTreePaymentController(
      { body: { nonce: "n", cart: [{ price: 10 }] }, user: { _id: "u1" } },
      res
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

/* ---------- REGRESSION lock-ins ---------- */
describe("REGRESSION lock-ins", () => {
  test("productCountController uses productModel.estimatedDocumentCount()", async () => {
    ProductModel.estimatedDocumentCount = jest.fn().mockResolvedValue(123);
    const res = makeRes();
    await productCountController({}, res);
    expect(ProductModel.estimatedDocumentCount).toHaveBeenCalled();
    const responder = pickResponder(res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(responder).toHaveBeenCalledWith({ success: true, total: 123 });
  });

  test("updateProductController returns 404 when product not found", async () => {
    ProductModel.findByIdAndUpdate.mockResolvedValue(null);
    const res = makeRes();
    await updateProductController(
      {
        fields: {
          name: "Name",
          description: "Desc",
          price: 1,
          category: "c",
          quantity: 1,
          shipping: false,
        },
        files: {},
        params: { pid: "missing" },
      },
      res
    );
    const responder = pickResponder(res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(responder).toHaveBeenCalledWith({
      success: false,
      message: "Product not found",
    });
  });

  test("updateProductController uses 200 OK on success (no photo)", async () => {
    const updated = { _id: "p1", photo: {}, save: jest.fn().mockResolvedValue({ _id: "p1" }) };
    ProductModel.findByIdAndUpdate.mockResolvedValue(updated);
    const res = makeRes();
    await updateProductController(
      {
        fields: {
          name: " Name ",
          description: "D",
          price: 5,
          category: "c",
          quantity: 2,
          shipping: true,
        },
        files: {},
        params: { pid: "p1" },
      },
      res
    );
    const responder = pickResponder(res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(responder).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "Product Updated Successfully",
      })
    );
  });

  test("productPhotoController sets Content-Type header", async () => {
    const product = { photo: { data: Buffer.from("X"), contentType: "image/png" } };
    ProductModel.findById.mockReturnValue({ select: () => Promise.resolve(product) });
    const res = makeRes();
    await productPhotoController({ params: { pid: OID1 } }, res);
    expect(res.set).toHaveBeenCalledWith("Content-Type", "image/png");
  });

  test("createProductController returns the saved document (includes _id)", async () => {
    const res = makeRes();
    await createProductController(
      {
        fields: {
          name: " New ",
          description: "d",
          price: 1,
          category: "c",
          quantity: 1,
          shipping: false,
        },
        files: {},
      },
      res
    );
    const responder = pickResponder(res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(responder).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "Product Created Successfully",
        products: expect.objectContaining({ _id: "prod1" }),
      })
    );
  });

  test("createProductController returns 400 on validation error (Name required)", async () => {
    const res = makeRes();
    await createProductController({ fields: { name: undefined }, files: {} }, res);
    const responder = pickResponder(res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(responder).toHaveBeenCalledWith({ error: "Name is Required" });
  });
});
