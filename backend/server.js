require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");
const orderRoutes = require("./routes/orders");
const paymentRoutes = require("./routes/payment");

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.get("/",(req,res)=>{
  res.json({status:"ok",message:"trailAPI is running"});
})

app.get("/api/health", (req, res) => res.json({ status: "healthy", service: "trail-backend" }));

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);

// Fallback 404
app.use((req, res) => res.status(404).json({ message: "Route not found" }));

// Central error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Something went wrong on our end" });
});

const { initRabbitMQ } = require("./config/rabbitmq");

const PORT = process.env.PORT || 5000;

connectDB().then(async () => {
  await initRabbitMQ();
  app.listen(PORT, () => console.log(`[server] trailAPI running on port ${PORT}`));
});

