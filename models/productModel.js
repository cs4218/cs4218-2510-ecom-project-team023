import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true, // <- trims "  Nice Chair  " -> "Nice Chair"
    },
    slug: {
      type: String,
      required: [true, "Slug is required"],
      trim: true,
      lowercase: true,      // <- "MiXeD-Case" -> "mixed-case"
      unique: true,         // <- must be unique
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price must be >= 0"], // <- no negatives
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [0, "Quantity must be >= 0"], // <- no negatives
      validate: {
        validator: Number.isInteger,     // <- integers only
        message: "Quantity must be an integer",
      },
    },
    photo: {
      data: Buffer,
      contentType: String,
    },
    shipping: {
      type: Boolean,
      default: false, // <- defaults to false
    },
  },
  { timestamps: true } // <- createdAt/updatedAt
);

// Redundant but explicit unique index (keeps behavior even if `unique` on path is altered)
productSchema.index({ slug: 1 }, { unique: true });

export default mongoose.model("Product", productSchema);
