// server/controllers/review.controller.js
const User = require("../models/user.model");

/** POST /api/reviews  (auth required) — save review for the logged-in user */
exports.create = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { rating, text } = req.body || {};
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "rating (1-5) required" });
    }

    await User.findByIdAndUpdate(
      userId,
      {
        $push: {
          reviews: {
            rating: Number(rating),
            text: String(text || ""),
            createdAt: new Date(),
          },
        },
      },
      { new: true }
    );

    res.json({ ok: true });
  } catch (e) {
    console.error("[reviews.create] error:", e);
    res.status(500).json({ error: e.message || "Failed to save review" });
  }
};

/** GET /api/reviews  (public) — list all reviews with user names, newest first */
exports.list = async (_req, res) => {
  try {
    const users = await User.find(
      { "reviews.0": { $exists: true } },
      { "fullname": 1, "reviews": 1 }
    ).lean();

    const items = [];
    for (const u of users) {
      const fname = (u.fullname?.firstname || "").trim();
      const lname = (u.fullname?.lastname || "").trim();
      const displayName = [fname, lname].filter(Boolean).join(" ") || "Anonymous";

      (u.reviews || []).forEach((r, idx) => {
        items.push({
          id: `${u._id}-${idx}`,
          user: { name: displayName },
          rating: r?.rating ?? 0,
          text: r?.text || "",
          createdAt: r?.createdAt || new Date(0),
        });
      });
    }

    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(items);
  } catch (e) {
    console.error("[reviews.list] error:", e);
    res.status(500).json({ error: e.message || "Failed to fetch reviews" });
  }
};
