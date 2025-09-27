import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      unique: true,          // create a unique index
      trim: true,            // ensures "  Phones  " -> "Phones"
    },
    slug: {
      type: String,
      required: [true, "Slug is required"],
      lowercase: true,       // auto-lowercase
      trim: true,
    },
  },
  {
    timestamps: true,        // adds createdAt / updatedAt
  }
);

// (Optional but explicit) ensure the unique index is created
categorySchema.index({ name: 1 }, { unique: true });

export default mongoose.model("Category", categorySchema);
