// backend/routes/message.routes.js
const router = require("express").Router();

// Robust import for auth middleware (supports both 'middlewares' and 'middleware' folders)
let auth;
try {
  auth = require("../middlewares/auth.middleware");
} catch (e) {
  try {
    auth = require("../middleware/auth.middleware");
  } catch (e2) {
    console.error("[message.routes] Could not load auth.middleware from expected paths");
    auth = {};
  }
}
const authUser = typeof auth?.authUser === "function" ? auth.authUser : (req, res, next) => {
  console.error("[message.routes] authUser is not available. Check your auth.middleware export.");
  return res.status(500).json({ message: "Server auth misconfigured" });
};

// Controller
const Ctrl = require("../controllers/message.controller");

// IMPORTANT: more specific routes before params
// GET /api/messages/threads
router.get("/threads", authUser, Ctrl.getThreads);

// GET /api/messages/:peerId   (works with your frontend)
router.get("/:peerId", authUser, Ctrl.getConversation);

// POST /api/messages          (works with your frontend)
router.post("/", authUser, Ctrl.sendMessage);

// ---- Legacy aliases (only if you still call them elsewhere) ----
// GET /api/messages/conversation/:userId
router.get("/conversation/:userId", authUser, Ctrl.getConversation);
// POST /api/messages/send
router.post("/send", authUser, Ctrl.sendMessage);

// NOTE: We intentionally removed any `router.patch(...)` here to avoid the crash you saw.
// If you later add a PATCH route (e.g., markRead), ensure the controller function exists
// and that `authUser` is importing correctly.

module.exports = router;
