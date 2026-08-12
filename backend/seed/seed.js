require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Product = require("../models/Product");
const products = require("./products");

async function run() {
  await connectDB();
  await Product.deleteMany({});
  await Product.insertMany(products);
  console.log(`[seed] Inserted ${products.length} jerseys`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("[seed] Failed:", err);
  process.exit(1);
});
