const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    size: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true }, // price at time of order, never trust client totals
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: { type: [orderItemSchema], required: true },
    total: { type: Number, required: true },
    currency: { type: String, default: "INR" },

    // Reference to the Payment that settled this order (set on successful verification)
    payment: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" },

    // paymentStatus is the source-of-truth synced from the Payment collection.
    // Kept denormalised on Order for query convenience (e.g. listing only paid orders).
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "cancelled"],
      default: "pending",
    },
    status: {
      type: String,
      enum: ["pending", "placed", "processing", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// ---- Indexes ----
orderSchema.index({ user: 1, paymentStatus: 1, createdAt: -1 });

module.exports = mongoose.model("Order", orderSchema);
