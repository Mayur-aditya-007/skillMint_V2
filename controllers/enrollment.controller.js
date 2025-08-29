// server/controllers/enrollment.controller.js
const User = require("../models/user.model");

function who(req) {
  const u = req.user || {};
  return `${u?.id || u?._id || "no-user"} (${u?.email || u?.username || "no-email"})`;
}

/** GET /api/enrollments  (auth) */
exports.list = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    console.log("[enrollments.list] user:", who(req));
    const user = await User.findById(userId, { enrolledCourses: 1 }).lean();
    return res.json(user?.enrolledCourses ?? []);
  } catch (e) {
    console.error("[enrollments.list] error:", e);
    return res.status(500).json({ error: "Failed to load enrollments" });
  }
};

/** POST /api/enrollments  (auth)
 * Body: { courseId, name, thumbnail }
 * Atomic insert if not enrolled yet; idempotent.
 */
exports.create = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { courseId, name, thumbnail } = req.body || {};
    console.log("[enrollments.create] user:", who(req), "body:", req.body);

    if (!courseId || !name) {
      return res.status(400).json({ error: "courseId and name are required" });
    }

    const now = new Date();
    const result = await User.updateOne(
      { _id: userId, "enrolledCourses.courseId": { $ne: String(courseId) } },
      {
        $push: {
          enrolledCourses: {
            courseId: String(courseId),
            courseName: String(name), // map frontend `name` → schema `courseName`
            thumbnail: thumbnail || "",
            progress: 0,
            isCompleted: false,
            enrolledAt: now,
            updatedAt: now,
          },
        },
      }
    );

    console.log("[enrollments.create] matched:", result.matchedCount, "modified:", result.modifiedCount);
    return res.json({ ok: true, added: result.modifiedCount > 0 });
  } catch (e) {
    console.error("[enrollments.create] error:", e);
    return res.status(500).json({ error: "Failed to enroll" });
  }
};
