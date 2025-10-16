// models/orderModel.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const orderSchema = new Schema(
  {
    // Accept either array of ObjectIds or array of objects (id/name/price/qty)
    // This keeps backward compatibility with unit tests and allows richer data for integrations.
    products: {
      type: [Schema.Types.Mixed],
      required: true,
      default: [],
    },

    payment: {
      type: Schema.Types.Mixed,
      required: false,
    },

    // Buyer reference
    buyer: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },

    // Status enum & default matching unit tests (capitalized labels)
    status: {
      type: String,
      enum: ["Not Process", "Processing", "Shipped", "Delivered", "Cancel"],
      default: "Not Process",
      required: false,
    },
  },
  { timestamps: true }
);

// Optional: lean transform to keep product subdocs as plain objects when using .lean()
orderSchema.set("toJSON", { virtuals: true });
orderSchema.set("toObject", { virtuals: true });

export default mongoose.model("orders", orderSchema);
