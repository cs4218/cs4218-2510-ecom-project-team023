import categoryModel from "../models/categoryModel.js";
import slugify from "slugify";

/** Normalize a category name:
 * - trim extra whitespace
 * - collapse internal spaces
 * - title-case words (Phones -> Phones, phones -> Phones, "  phones  " -> "Phones")
 */
function canonicalizeName(name) {
  const normalized = String(name ?? "").trim().replace(/\s+/g, " ");
  if (!normalized) return "";
  return normalized
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export const createCategoryController = async (req, res) => {
  try {
    const rawName = req.body?.name;
    const canonName = canonicalizeName(rawName);

    if (!canonName) {
      return res.status(400).send({ message: "Name is required" });
    }

    // Duplicate check should consider trimming/case-normalization
    const existingCategory = await categoryModel.findOne({ name: canonName });
    if (existingCategory) {
      return res.status(409).send({
        success: false,
        message: "Category already exists",
      });
    }

    const category = await new categoryModel({
      name: canonName,
      slug: slugify(canonName),
    }).save();

    return res.status(201).send({
      success: true,
      message: "new category created",
      category,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log(error);
    return res.status(500).send({
      success: false,
      error,
      message: "Error in Category",
    });
  }
};

// update category
export const updateCategoryController = async (req, res) => {
  try {
    const rawName = req.body?.name;
    const { id } = req.params;

    const canonName = canonicalizeName(rawName);
    if (!canonName) {
      return res.status(400).send({ message: "Name is required" });
    }

    const category = await categoryModel.findByIdAndUpdate(
      id,
      { name: canonName, slug: slugify(canonName) },
      { new: true }
    );

    if (!category) {
      return res.status(404).send({
        success: false,
        message: "Category not found",
      });
    }

    return res.status(200).send({
      success: true,
      message: "Category Updated Successfully",
      category,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log(error);
    return res.status(500).send({
      success: false,
      error,
      message: "Error while updating category",
    });
  }
};

// get all categories
export const categoryControlller = async (req, res) => {
  try {
    const category = await categoryModel.find({});
    return res.status(200).send({
      success: true,
      message: "All Categories List",
      category,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log(error);
    return res.status(500).send({
      success: false,
      error,
      message: "Error while getting all categories",
    });
  }
};

// single category
export const singleCategoryController = async (req, res) => {
  try {
    const category = await categoryModel.findOne({ slug: req.params.slug });

    if (!category) {
      return res.status(404).send({
        success: false,
        message: "Category not found",
      });
    }

    return res.status(200).send({
      success: true,
      message: "Get SIngle Category SUccessfully",
      category,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log(error);
    return res.status(500).send({
      success: false,
      error,
      message: "Error While getting Single Category",
    });
  }
};

// delete category
export const deleteCategoryCOntroller = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await categoryModel.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).send({
        success: false,
        message: "Category not found",
      });
    }

    return res.status(200).send({
      success: true,
      message: "Categry Deleted Successfully",
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log(error);
    return res.status(500).send({
      success: false,
      message: "error while deleting category",
      error,
    });
  }
};
