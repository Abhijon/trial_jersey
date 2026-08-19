require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Order = require("../models/Order");

async function cleanOrders() {
  try {
    await connectDB();

    console.log("[clean-orders] Running order cleanup migration...\n");

    // 1. Set status → "pending" for any unpaid orders that still say "placed"
    const statusResult = await Order.updateMany(
      { paymentStatus: { $ne: "paid" }, status: { $ne: "pending" } },
      { $set: { status: "pending" } }
    );
    console.log(`  [1] Fixed order status on ${statusResult.modifiedCount || 0} unpaid orders`);

    // 2. Remove legacy Razorpay fields from Orders (those now live in the Payment collection)
    const legacyResult = await Order.updateMany(
      { razorpayOrderId: { $exists: true } },
      { $unset: { razorpayOrderId: "", razorpayPaymentId: "", razorpaySignature: "" } }
    );
    console.log(`  [2] Removed legacy Razorpay fields from ${legacyResult.modifiedCount || 0} orders`);

    // Summary
    const paid = await Order.countDocuments({ paymentStatus: "paid" });
    const pending = await Order.countDocuments({ paymentStatus: "pending" });
    const failed = await Order.countDocuments({ paymentStatus: { $in: ["failed", "cancelled"] } });

    console.log("\n[clean-orders] Current Order Summary:");
    console.log(`  Paid    (visible on frontend): ${paid}`);
    console.log(`  Pending                      : ${pending}`);
    console.log(`  Failed / Cancelled           : ${failed}`);

    await mongoose.disconnect();
    console.log("\n[clean-orders] Done!");
    process.exit(0);
  } catch (err) {
    console.error("[clean-orders] Error:", err);
    process.exit(1);
  }
}

cleanOrders();
