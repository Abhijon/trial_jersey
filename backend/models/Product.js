const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    club: { type: String, required: true, trim: true }, // e.g. "trailUnited"
    kitType: {
      type: String,
      enum: ["home", "away", "third", "retro", "goalkeeper", "anthem"],
      default: "home",
    },
    season: { type: String, default: "2026/27" },
    price: { type: Number, required: true }, // stored in smallest currency unit-free number, e.g. 79.99
    currency: { type: String, default: "USD" },
    sizes: { type: [String], default: ["S", "M", "L", "XL", "XXL"] },
    description: { type: String, required: true },
    image: { type: String, required: true }, // path under /images/products/
    featured: { type: Boolean, default: false },
    stock: { type: Number, default: 25 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
