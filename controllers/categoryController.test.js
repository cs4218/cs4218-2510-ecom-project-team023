// controllers/categoryController.test.js using of jest and mocks aided by chatgpt

// ---------- Mocks ----------
jest.mock("slugify", () => (s) =>
  String(s ?? "").trim().toLowerCase().replace(/\s+/g, "-")
);

jest.mock("../models/categoryModel.js", () => {
  const Model = Object.assign(jest.fn(), {
    findOne: jest.fn(),
    find: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
  });
  Model.mockImplementation((doc = {}) => ({
    save: jest.fn().mockResolvedValue({ _id: "cat1", ...doc }),
  }));
  return Model;
});

const Category = require("../models/categoryModel.js");

const {
  createCategoryController,
  updateCategoryController,
  categoryControlller,
  singleCategoryController,
  deleteCategoryCOntroller,
} = require("./categoryController.js");

// ---------- helpers ----------
const makeRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.send = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
  Category.findOne.mockReset();
  Category.find.mockReset();
  Category.findByIdAndUpdate.mockReset();
  Category.findByIdAndDelete.mockReset();
  Category.mockClear();
});

// =========================================
// createCategoryController
// =========================================
describe("createCategoryController", () => {
  test.each([
    { name: undefined, label: "undefined name" },
    { name: null, label: "null name" },
    { name: "", label: "empty string name" },
    { name: "   ", label: "whitespace only" },
  ])("400 when name missing (%s)", async ({ name }) => {
    const res = makeRes();
    await createCategoryController({ body: { name } }, res);
    expect(Category.findOne).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({ message: "Name is required" });
  });

  test("409 duplicate after trim/case-normalize", async () => {
    Category.findOne.mockImplementation(async (q) => {
      if (q?.name === "Phones") return { _id: "exists" };
      return null;
    });

    const res = makeRes();
    await createCategoryController({ body: { name: "  phones  " } }, res);

    expect(Category.findOne).toHaveBeenCalledWith({ name: "Phones" });
    expect(Category).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Category already exists",
      })
    );
  });

  test("201 creates when not duplicate (canonicalizes name + slug)", async () => {
    Category.findOne.mockResolvedValue(null);
    const res = makeRes();
    await createCategoryController(
      { body: { name: "  Phones & Gadgets  " } },
      res
    );
    expect(Category).toHaveBeenCalledWith({
      name: "Phones & Gadgets",
      slug: "phones-&-gadgets",
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "new category created",
        category: expect.objectContaining({ _id: "cat1" }),
      })
    );
  });

  test("500 when findOne throws", async () => {
    Category.findOne.mockRejectedValue(new Error("DB boom"));
    const res = makeRes();
    await createCategoryController({ body: { name: "Laptops" } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: "Error in Category" })
    );
  });

  test("500 when save throws", async () => {
    Category.findOne.mockResolvedValue(null);
    Category.mockImplementation(() => ({
      save: jest.fn().mockRejectedValue(new Error("save failed")),
    }));
    const res = makeRes();
    await createCategoryController({ body: { name: "TVs" } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: "Error in Category" })
    );
  });
});

// =========================================
// updateCategoryController
// =========================================
describe("updateCategoryController", () => {
  test("400 when name missing", async () => {
    const res = makeRes();
    await updateCategoryController({ params: { id: "c1" }, body: {} }, res);
    expect(Category.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({ message: "Name is required" });
  });

  test("404 when category not found", async () => {
    Category.findByIdAndUpdate.mockResolvedValue(null);
    const res = makeRes();
    await updateCategoryController(
      { params: { id: "missing" }, body: { name: "New Name" } },
      res
    );
    expect(Category.findByIdAndUpdate).toHaveBeenCalledWith(
      "missing",
      { name: "New Name", slug: "new-name" },
      { new: true }
    );
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Category not found",
    });
  });

  test("200 updates and returns payload with 'message' key", async () => {
    Category.findByIdAndUpdate.mockResolvedValue({
      _id: "c1",
      name: "New Name",
      slug: "new-name",
    });
    const res = makeRes();
    await updateCategoryController(
      { params: { id: "c1" }, body: { name: "New Name" } },
      res
    );
    expect(Category.findByIdAndUpdate).toHaveBeenCalledWith(
      "c1",
      { name: "New Name", slug: "new-name" },
      { new: true }
    );
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.send.mock.calls[0][0];
    expect(payload).toHaveProperty(
      "message",
      "Category Updated Successfully"
    );
    expect(payload).toMatchObject({
      success: true,
      category: { _id: "c1", name: "New Name", slug: "new-name" },
    });
  });

  test("500 when update throws", async () => {
    Category.findByIdAndUpdate.mockRejectedValue(new Error("update failed"));
    const res = makeRes();
    await updateCategoryController(
      { params: { id: "c3" }, body: { name: "X" } },
      res
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Error while updating category",
      })
    );
  });
});

// =========================================
// categoryControlller (get all)
// =========================================
describe("categoryControlller (get all)", () => {
  test("200 returns list", async () => {
    Category.find.mockResolvedValue([{ _id: "a" }, { _id: "b" }]);
    const res = makeRes();
    await categoryControlller({}, res);
    expect(Category.find).toHaveBeenCalledWith({});
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "All Categories List",
        category: [{ _id: "a" }, { _id: "b" }],
      })
    );
  });

  test("500 on DB error", async () => {
    Category.find.mockRejectedValue(new Error("find blew up"));
    const res = makeRes();
    await categoryControlller({}, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Error while getting all categories",
      })
    );
  });
});

// =========================================
// singleCategoryController
// =========================================
describe("singleCategoryController", () => {
  test("200 returns single by slug", async () => {
    Category.findOne.mockResolvedValue({ _id: "p", slug: "phones" });
    const res = makeRes();
    await singleCategoryController({ params: { slug: "phones" } }, res);
    expect(Category.findOne).toHaveBeenCalledWith({ slug: "phones" });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("404 when not found", async () => {
    Category.findOne.mockResolvedValue(null);
    const res = makeRes();
    await singleCategoryController({ params: { slug: "missing" } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Category not found",
    });
  });

  test("500 on DB error", async () => {
    Category.findOne.mockRejectedValue(new Error("lookup fail"));
    const res = makeRes();
    await singleCategoryController({ params: { slug: "oops" } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// =========================================
// deleteCategoryCOntroller
// =========================================
describe("deleteCategoryCOntroller", () => {
  test("200 deletes by id", async () => {
    Category.findByIdAndDelete.mockResolvedValue({ _id: "gone" });
    const res = makeRes();
    await deleteCategoryCOntroller({ params: { id: "deadbeef" } }, res);
    expect(Category.findByIdAndDelete).toHaveBeenCalledWith("deadbeef");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("404 when id not found", async () => {
    Category.findByIdAndDelete.mockResolvedValue(null);
    const res = makeRes();
    await deleteCategoryCOntroller({ params: { id: "missing" } }, res);
    expect(Category.findByIdAndDelete).toHaveBeenCalledWith("missing");
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Category not found",
    });
  });

  test("500 on DB error", async () => {
    Category.findByIdAndDelete.mockRejectedValue(new Error("delete fail"));
    const res = makeRes();
    await deleteCategoryCOntroller({ params: { id: "x" } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
