const Razorpay = require("razorpay");

function getRazorpayInstance() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret || key_id.includes("YOUR_KEY_ID")) {
    console.warn("[razorpay] Warning: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not configured properly in .env");
  }

  return new Razorpay({
    key_id: key_id || "rzp_test_dummy",
    key_secret: key_secret || "dummy_secret",
  });
}

module.exports = getRazorpayInstance;
