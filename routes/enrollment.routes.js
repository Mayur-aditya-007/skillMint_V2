// routes/enrollment.routes.js
const express = require("express");
const router = express.Router();

const { authUser } = require("../middleware/auth.middleware");
const ctrl = require("../controllers/enrollment.controller");

// Optional: disable caching so the browser never serves a 304 for enrollments
const nocache = (_req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
};

// --- Routes ---
router.get("/api/enrollments", authUser, nocache, ctrl.list);
router.post("/api/enrollments", authUser, nocache, ctrl.create);

// --- Export ---
module.exports = router;
