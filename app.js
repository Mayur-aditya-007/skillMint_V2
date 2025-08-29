// app.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");

const reviewRoutes = require("./routes/review.routes");
const enrollmentRoutes = require("./routes/enrollment.routes");
const userRoutes = require("./routes/user.routes");
const courseRoutes = require("./routes/course.routes");
const messageRoutes = require("./routes/message.routes");

const app = express();

/* ---------------------------- Middleware setup ---------------------------- */
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";
app.set("etag", false);
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.set("Surrogate-Control", "no-store");
  }
  next();
});
app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(morgan("dev"));

/* --------------------------------- Routes -------------------------------- */
app.get("/", (_req, res) => res.send("skillMint backend is up"));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    corsOrigin: CORS_ORIGIN,
    env: process.env.NODE_ENV || "development",
  });
});

app.use(reviewRoutes);
app.use(enrollmentRoutes);
app.use("/user", userRoutes);
app.use("/courses", courseRoutes);

// 🔴 Messages API
app.use("/api/messages", messageRoutes);

/* ------------------------------- 404 / Errors ----------------------------- */
app.use((req, res, next) => {
  if (res.headersSent) return next();
  res.status(404).json({ error: "Not Found" });
});

app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

module.exports = app;
