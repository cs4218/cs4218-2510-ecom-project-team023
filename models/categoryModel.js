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

export default mongoose.model("Category", categorySchema);
