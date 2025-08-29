// server/routes/review.routes.js
const router = require("express").Router();
const { authUser } = require("../middleware/auth.middleware");
const reviewCtrl = require("../controllers/review.controller");

// Public list endpoint
router.get("/api/reviews", reviewCtrl.list);

// Auth-only create endpoint (was already present)
router.post("/api/reviews", authUser, reviewCtrl.create);

module.exports = router;
