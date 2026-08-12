const express = require("express");
const Product = require("../models/Product");

const router = express.Router();

// GET /api/products - list all jerseys, optional ?kitType=away&club=Trail%20United
router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (req.query.kitType) filter.kitType = req.query.kitType;
    if (req.query.club) filter.club = req.query.club;

    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json({ products });
  } catch (err) {
    res.status(500).json({ message: "Could not load products", error: err.message });
  }
});

// GET /api/products/:id - single jersey detail
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Jersey not found" });
    }
    res.json({ product });
  } catch (err) {
    res.status(400).json({ message: "Invalid product id" });
  }
});

module.exports = router;
