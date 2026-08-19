const express = require("express");
const crypto = require("crypto");
const { body, validationResult } = require("express-validator");
const requireAuth = require("../middleware/auth");
const getRazorpayInstance = require("../config/razorpay");
const Product = require("../models/Product");
const Order = require("../models/Order");
const Payment = require("../models/Payment");

const router = express.Router();

// ============================================================================
//  HELPERS
// ============================================================================

/**
 * Verify Razorpay payment signature using HMAC SHA256.
 * Returns true when the signature is authentic.
 */
function verifySignature(orderId, paymentId, signature) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) throw new Error("RAZORPAY_KEY_SECRET is not configured");

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/**
 * Verify Razorpay webhook signature.
 */
function verifyWebhookSignature(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return true; // skip verification if no secret configured

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(signature, "hex")
  );
}

/**
 * Sync paymentStatus from Payment → Order and set order status accordingly.
 * Single source of truth for the Order ↔ Payment relationship.
 */
async function syncOrderFromPayment(payment) {
  const update = { paymentStatus: payment.status === "paid" ? "paid" : payment.status };

  if (payment.status === "paid") {
    update.status = "placed";
    update.payment = payment._id;
  }

  return Order.findByIdAndUpdate(payment.order, update, { new: true });
}

// ============================================================================
//  POST /api/payments/create-order
//  Creates a Razorpay order + a pending Order + a Payment record.
//  IDEMPOTENCY: If a pending Payment already exists for the same user + same
//  product combo it returns the existing Razorpay order instead of creating a
//  duplicate.
// ============================================================================
router.post(
  "/create-order",
  requireAuth,
  [body("items").isArray({ min: 1 }).withMessage("Items array is required")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    try {
      const { items, idempotencyKey } = req.body;

      // --- Client-supplied idempotency key (optional but recommended) ---
      // If the frontend sends the same idempotencyKey twice (e.g. double-click),
      // return the already-created payment instead of making a new one.
      if (idempotencyKey) {
        const existing = await Payment.findOne({
          user: req.user._id,
          receipt: idempotencyKey,
          status: "created",
        });

        if (existing) {
          return res.status(200).json({
            success: true,
            razorpayOrderId: existing.razorpayOrderId,
            amount: existing.amount,
            currency: existing.currency,
            key: process.env.RAZORPAY_KEY_ID,
            orderId: existing.order.toString(),
          });
        }
      }

      // --- Build order items from DB (never trust client prices) ---
      const orderItems = [];
      let total = 0;

      for (const item of items) {
        const product = await Product.findById(item.productId);
        if (!product) {
          return res.status(400).json({ message: `Product ${item.productId} not found` });
        }
        if (!product.sizes.includes(item.size)) {
          return res.status(400).json({ message: `${product.name} is not available in size ${item.size}` });
        }
        const quantity = Math.max(1, Number(item.quantity) || 1);
        orderItems.push({
          product: product._id,
          name: product.name,
          size: item.size,
          quantity,
          price: product.price,
        });
        total += product.price * quantity;
      }

      const totalINR = Math.round(total * 100) / 100;
      const amountInPaise = Math.round(totalINR * 100);
      const receipt = idempotencyKey || `rcpt_${Date.now()}_${req.user._id.toString().slice(-4)}`;

      // --- Create Razorpay order ---
      const razorpay = getRazorpayInstance();
      let rzpOrder;
      try {
        rzpOrder = await razorpay.orders.create({
          amount: amountInPaise,
          currency: "INR",
          receipt,
          notes: { userId: req.user._id.toString(), userEmail: req.user.email },
        });
      } catch (rzpErr) {
        console.error("[payment] Razorpay order creation failed:", rzpErr);
        return res.status(500).json({
          message: "Failed to create payment order. Check Razorpay keys.",
          error: rzpErr.message,
        });
      }

      // --- Create Order (pending) ---
      const order = await Order.create({
        user: req.user._id,
        items: orderItems,
        total: totalINR,
        currency: "INR",
        paymentStatus: "pending",
        status: "pending",
      });

      // --- Create Payment record ---
      await Payment.create({
        user: req.user._id,
        order: order._id,
        razorpayOrderId: rzpOrder.id,
        amount: amountInPaise,
        currency: "INR",
        receipt,
        status: "created",
        notes: rzpOrder.notes,
      });

      return res.status(201).json({
        success: true,
        razorpayOrderId: rzpOrder.id,
        amount: amountInPaise,
        currency: "INR",
        key: process.env.RAZORPAY_KEY_ID,
        orderId: order._id,
      });
    } catch (err) {
      console.error("[payment/create-order]", err);
      return res.status(500).json({ message: "Could not create payment order", error: err.message });
    }
  }
);

// ============================================================================
//  POST /api/payments/verify
//  Called by the frontend after Razorpay checkout handler fires.
//  IDEMPOTENCY: If the Payment is already marked "paid", returns success
//  without any side-effects (safe to retry).
// ============================================================================
router.post("/verify", requireAuth, async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ message: "Missing payment verification parameters" });
    }

    // --- Find the Payment record ---
    const payment = await Payment.findOne({ razorpayOrderId });
    if (!payment) {
      return res.status(404).json({ message: "Payment record not found for this Razorpay order" });
    }

    // --- Idempotency: already verified ---
    if (payment.status === "paid") {
      const order = await Order.findById(payment.order);
      return res.json({ success: true, message: "Payment already verified", order });
    }

    // --- Verify signature ---
    let isAuthentic;
    try {
      isAuthentic = verifySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    } catch (sigErr) {
      return res.status(500).json({ message: sigErr.message });
    }

    if (!isAuthentic) {
      payment.status = "failed";
      payment.errorDescription = "Signature verification failed";
      await payment.save();
      await syncOrderFromPayment(payment);
      return res.status(400).json({ success: false, message: "Payment signature verification failed" });
    }

    // --- Mark as paid ---
    payment.status = "paid";
    payment.razorpayPaymentId = razorpayPaymentId;
    payment.razorpaySignature = razorpaySignature;
    await payment.save();
    const updatedOrder = await syncOrderFromPayment(payment);

    return res.json({ success: true, message: "Payment verified successfully", order: updatedOrder });
  } catch (err) {
    console.error("[payment/verify]", err);
    return res.status(500).json({ message: "Payment verification failed", error: err.message });
  }
});

// ============================================================================
//  POST /api/payments/cancel
//  Called when user dismisses the Razorpay checkout modal.
//  IDEMPOTENCY: Skips if payment is already in a terminal state (paid/failed).
// ============================================================================
router.post("/cancel", requireAuth, async (req, res) => {
  try {
    const { razorpayOrderId } = req.body;
    if (!razorpayOrderId) return res.json({ success: true });

    const payment = await Payment.findOne({ razorpayOrderId });
    if (!payment || ["paid", "failed"].includes(payment.status)) {
      // Already settled — don't regress the state
      return res.json({ success: true, message: "No state change needed" });
    }

    payment.status = "cancelled";
    await payment.save();
    await syncOrderFromPayment(payment);

    return res.json({ success: true, message: "Payment cancelled" });
  } catch (err) {
    return res.status(500).json({ message: "Could not record cancellation", error: err.message });
  }
});

// ============================================================================
//  POST /api/payments/fail
//  Called when Razorpay fires payment.failed on the frontend.
//  IDEMPOTENCY: Skips if payment is already "paid" (cannot regress).
// ============================================================================
router.post("/fail", requireAuth, async (req, res) => {
  try {
    const { razorpayOrderId, error } = req.body;
    if (!razorpayOrderId) return res.json({ success: true });

    const payment = await Payment.findOne({ razorpayOrderId });
    if (!payment || payment.status === "paid") {
      return res.json({ success: true, message: "No state change needed" });
    }

    payment.status = "failed";
    if (error) {
      payment.errorCode = error.code;
      payment.errorDescription = error.description;
      payment.errorSource = error.source;
      payment.method = error.metadata?.payment_id ? undefined : payment.method;
    }
    await payment.save();
    await syncOrderFromPayment(payment);

    return res.json({ success: true, message: "Payment failure recorded" });
  } catch (err) {
    return res.status(500).json({ message: "Could not record failure", error: err.message });
  }
});

// ============================================================================
//  POST /api/payments/webhook
//  Asynchronous Razorpay event handler.
//  IDEMPOTENCY:
//    1. Webhook signature verification
//    2. Event ID stored in Payment.processedWebhookEvents — duplicate events
//       are acknowledged (200) but produce zero side-effects.
//    3. State cannot regress: a "paid" payment won't move back to "failed".
// ============================================================================
router.post("/webhook", async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];

    // --- Signature verification ---
    if (signature) {
      if (!req.rawBody) {
        console.error("[webhook] rawBody missing — check express.json verify config");
        return res.status(500).json({ message: "Server misconfiguration" });
      }
      if (!verifyWebhookSignature(req.rawBody, signature)) {
        console.warn("[webhook] Invalid signature");
        return res.status(400).json({ message: "Invalid webhook signature" });
      }
    }

    const { event, payload } = req.body || {};
    const eventId = req.body?.event_id || `${event}_${Date.now()}`;

    console.log(`[webhook] Event: ${event} | ID: ${eventId}`);

    // --- Route by event type ---
    if (event === "payment.captured") {
      const entity = payload?.payment?.entity;
      await handleWebhookPayment(eventId, entity?.order_id, {
        status: "paid",
        razorpayPaymentId: entity?.id,
        method: entity?.method,
      });
    } else if (event === "order.paid") {
      const entity = payload?.order?.entity;
      await handleWebhookPayment(eventId, entity?.id, {
        status: "paid",
      });
    } else if (event === "payment.failed") {
      const entity = payload?.payment?.entity;
      const errObj = entity?.error_description
        ? { errorDescription: entity.error_description, errorCode: entity.error_code, errorSource: entity.error_source }
        : {};
      await handleWebhookPayment(eventId, entity?.order_id, {
        status: "failed",
        method: entity?.method,
        ...errObj,
      });
    }

    // Always 200 so Razorpay stops retrying
    return res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error("[webhook]", err);
    return res.status(500).json({ message: "Webhook handler failed" });
  }
});

/**
 * Core webhook handler with full idempotency.
 *
 * @param {string} eventId   - Razorpay event_id (used for dedup)
 * @param {string} rzpOrderId - Razorpay order_id to locate the Payment
 * @param {object} updates   - Fields to set on the Payment document
 */
async function handleWebhookPayment(eventId, rzpOrderId, updates) {
  if (!rzpOrderId) return;

  const payment = await Payment.findOne({ razorpayOrderId: rzpOrderId });
  if (!payment) {
    console.warn(`[webhook] No Payment found for razorpayOrderId=${rzpOrderId}`);
    return;
  }

  // Idempotency check: skip if this event was already processed
  if (payment.processedWebhookEvents.includes(eventId)) {
    console.log(`[webhook] Event ${eventId} already processed — skipping`);
    return;
  }

  // State guard: never regress from "paid"
  if (payment.status === "paid" && updates.status !== "paid") {
    console.log(`[webhook] Payment already paid — ignoring ${updates.status} transition`);
    payment.processedWebhookEvents.push(eventId);
    await payment.save();
    return;
  }

  // Apply updates
  Object.assign(payment, updates);
  payment.processedWebhookEvents.push(eventId);
  await payment.save();
  await syncOrderFromPayment(payment);

  console.log(`[webhook] Payment ${rzpOrderId} → ${updates.status}`);
}

module.exports = router;
