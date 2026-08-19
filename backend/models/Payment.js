const mongoose = require("mongoose");

/**
 * Payment Model
 *
 * Dedicated collection that tracks every payment attempt independently from Orders.
 * Designed around three idempotency guarantees:
 *   1. razorpayOrderId  — unique per Razorpay checkout session
 *   2. razorpayPaymentId — unique per successful card/UPI charge (sparse: only present after success)
 *   3. webhookEventId   — unique per Razorpay webhook delivery (prevents duplicate webhook processing)
 */

const paymentSchema = new mongoose.Schema(
  {
    // ---- Relationships ----
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },

    // ---- Razorpay Identifiers ----
    razorpayOrderId: { type: String, required: true, unique: true },
    razorpayPaymentId: { type: String, sparse: true },
    razorpaySignature: { type: String },

    // ---- Financial ----
    amount: { type: Number, required: true },       // amount in paise (e.g. 299900 = ₹2999)
    currency: { type: String, default: "INR" },
    receipt: { type: String },

    // ---- Status Machine ----
    // created   → Razorpay order created, checkout opened
    // attempted → user initiated payment in modal (optional, set by frontend fail/cancel)
    // paid      → signature verified, funds captured
    // failed    → Razorpay returned payment.failed or signature mismatch
    // cancelled → user dismissed the checkout modal without paying
    status: {
      type: String,
      enum: ["created", "attempted", "paid", "failed", "cancelled"],
      default: "created",
    },

    // ---- Idempotency / Webhook ----
    // Stores Razorpay webhook event IDs we have already processed.
    // Queried before processing any webhook to prevent duplicate side-effects.
    processedWebhookEvents: { type: [String], default: [] },

    // ---- Error Tracking ----
    errorCode: { type: String },
    errorDescription: { type: String },
    errorSource: { type: String },

    // ---- Metadata ----
    method: { type: String },  // card, upi, netbanking, wallet etc.
    notes: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

// ---- Indexes for fast lookups ----
paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ order: 1 });
paymentSchema.index({ razorpayPaymentId: 1 }, { sparse: true });
paymentSchema.index({ status: 1 });

module.exports = mongoose.model("Payment", paymentSchema);
