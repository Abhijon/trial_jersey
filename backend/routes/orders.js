const express = require("express");
const { body, validationResult } = require("express-validator");
const Product = require("../models/Product");
const Order = require("../models/Order");
const requireAuth = require("../middleware/auth");

const router = express.Router();

// All order routes require a valid JWT. The order always belongs to req.user,
// never to an id the client sends - that's what keeps orders server-side secure.
router.use(requireAuth);

// POST /api/orders - place an order
// Body: { items: [{ productId, size, quantity }] }
router.post(
  "/",
  [
    body("items").isArray({ min: 1 }).withMessage("Your order needs at least one item"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    try {
      const { items } = req.body;

      // Re-fetch every product and price from the database. Never trust
      // a price or total sent from the frontend.
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

      const order = await Order.create({
        user: req.user._id,
        items: orderItems,
        total: Math.round(total * 100) / 100,
      });

      res.status(201).json({ order });
    } catch (err) {
      res.status(500).json({ message: "Could not place order", error: err.message });
    }
  }
);

// GET /api/orders - only the logged-in user's successfully paid orders
router.get("/", async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id, paymentStatus: "paid" }).sort({ createdAt: -1 });
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ message: "Could not load orders", error: err.message });
  }
});

// GET /api/orders/:id - only if it belongs to the logged-in user and is paid
router.get("/:id", async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id, paymentStatus: "paid" });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.json({ order });
  } catch (err) {
    res.status(400).json({ message: "Invalid order id" });
  }
});

module.exports = router;
