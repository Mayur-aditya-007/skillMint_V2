// controllers/user.controller.js
const mongoose = require("mongoose");
const { validationResult } = require("express-validator");
const userModel = require("../models/user.model");
const blackListTokenModel = require("../models/blackListToken.model");

// -------- shared helpers --------
const publicUser = (u, reqUser = null) => {
  if (!u) return null;
  const name = u.fullname?.firstname
    ? `${u.fullname.firstname} ${u.fullname.lastname || ""}`.trim()
    : undefined;

  const isConnected = !!reqUser && Array.isArray(reqUser.connections)
    ? reqUser.connections.some(id => String(id) === String(u._id))
    : false;

  return {
    _id: u._id,
    email: u.email,
    fullname: u.fullname,
    name,
    avatar: u.avatar || "",
    isConnected,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
};

// -------- auth --------
module.exports.registerUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: errors.array() });
    }

    const { fullname, email, password } = req.body;
    const firstName = fullname?.firstname ?? fullname?.firstName;
    const lastName  = fullname?.lastname ?? fullname?.lastName ?? "";

    if (!firstName || !email || !password) {
      return res.status(400).json({ success: false, message: "firstname, email, password are required" });
    }

    const isUserAlready = await userModel.findOne({ email: email.toLowerCase().trim() });
    if (isUserAlready) {
      return res.status(409).json({ success: false, message: "User with this email already exists" });
    }

    const user = await userModel.create({
      fullname: { firstname: firstName.trim(), lastname: lastName.trim() },
      email: email.toLowerCase().trim(),
      password,
    });

    const token = user.generateAuthToken();

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.status(201).json({ success: true, message: "User registered successfully", token, user: publicUser(user) });
  } catch (err) {
    if (err?.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(409).json({ success: false, message: `${field} already exists`, error: "DUPLICATE_ENTRY" });
    }
    return res.status(500).json({ success: false, message: "Registration failed" });
  }
};

module.exports.loginUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: errors.array() });
    }

    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: "Email and password are required" });

    const user = await userModel.findOne({ email: email.toLowerCase().trim() }).select("+password");
    if (!user) return res.status(401).json({ success: false, message: "Invalid email or password" });

    const ok = await (user.comparePassword ? user.comparePassword(password) : user.comparepassword(password));
    if (!ok) return res.status(401).json({ success: false, message: "Invalid email or password" });

    const token = user.generateAuthToken();
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({ success: true, message: "Login successful", token, user: publicUser(user) });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Login failed" });
  }
};

module.exports.getUserProfile = async (req, res) => {
  try {
    return res.status(200).json({ success: true, user: publicUser(req.user, req.user) });
  } catch {
    return res.status(500).json({ success: false, message: "Failed to get profile" });
  }
};

module.exports.logoutUser = async (req, res) => {
  try {
    const header = req.headers.authorization || "";
    const bearer = header.startsWith("Bearer ") ? header.slice(7) : undefined;
    const token = req.cookies?.token || bearer;

    res.clearCookie("token");
    if (token) {
      try { await blackListTokenModel.create({ token }); } catch {}
    }
    return res.status(200).json({ success: true, message: "Logged out successfully" });
  } catch {
    return res.status(500).json({ success: false, message: "Logout failed" });
  }
};

// -------- connect/search/profile --------
module.exports.searchUsers = async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    if (!q) return res.json({ success: true, data: [] });

    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(safe, "i");

    const rows = await userModel.find({
      $or: [
        { email: rx },
        { "fullname.firstname": rx },
        { "fullname.lastname": rx },
      ],
    })
      .select("_id email fullname avatar createdAt updatedAt")
      .limit(20)
      .lean();

    const data = rows
      .filter(u => String(u._id) !== String(req.user?._id))
      .map(u => publicUser(u, req.user));

    return res.json({ success: true, data });
  } catch (e) {
    console.error("[searchUsers] error:", e);
    return res.status(500).json({ success: false, message: "Search failed" });
  }
};

module.exports.getUserByIdPublic = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }

    const u = await userModel
      .findById(id)
      .select("_id email fullname avatar createdAt updatedAt")
      .lean();

    if (!u) return res.status(404).json({ success: false, message: "User not found" });

    return res.json({ success: true, data: publicUser(u, req.user || null) });
  } catch (e) {
    console.error("[getUserByIdPublic] error:", e);
    return res.status(500).json({ success: false, message: "Failed to fetch profile" });
  }
};

module.exports.toggleConnect = async (req, res) => {
  try {
    const { id } = req.params;
    const meId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }
    if (String(id) === String(meId)) {
      return res.status(400).json({ success: false, message: "Cannot connect to yourself" });
    }

    const me = await userModel.findById(meId);
    if (!me) return res.status(401).json({ success: false, message: "Unauthorized" });

    if (!Array.isArray(me.connections)) me.connections = [];

    const idx = me.connections.findIndex(x => String(x) === String(id));
    let connected;
    if (idx === -1) {
      me.connections.push(id);
      connected = true;
    } else {
      me.connections.splice(idx, 1);
      connected = false;
    }
    await me.save();

    return res.json({ success: true, connected });
  } catch (e) {
    console.error("[toggleConnect] error:", e);
    return res.status(500).json({ success: false, message: "Failed to toggle connect" });
  }
};

// -------- courses management (unchanged from earlier) --------
module.exports.addCourse = async (req, res) => {
  try {
    const incoming = req.body.course || req.body;
    const courseId = incoming.id || incoming._id || incoming.courseId;
    const courseName = incoming.name || incoming.title;
    const thumbnail = incoming.thumbnail || incoming.thumbnailUrl || "";

    if (!courseId || !courseName) {
      return res.status(400).json({ success: false, message: "Course id and name/title are required" });
    }

    const user = await userModel.findById(req.user._id);
    await user.addCourse({ courseId, name: courseName, thumbnail });

    const last = user.getEnrolledCourse(courseId);
    return res.status(201).json({ success: true, message: "Course added successfully", course: last });
  } catch (error) {
    if (error?.message === "Course already enrolled") {
      return res.status(409).json({ success: false, message: "Already enrolled in this course" });
    }
    return res.status(500).json({ success: false, message: "Failed to add course" });
  }
};

module.exports.getUserCourses = async (req, res) => {
  try {
    const { page = 1, limit = 10, sortBy = "enrolledAt", order = "desc" } = req.query;
    const user = await userModel.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const courses = [...user.enrolledCourses].sort((a, b) => {
      const aVal = a[sortBy] ?? a.updatedAt ?? 0;
      const bVal = b[sortBy] ?? b.updatedAt ?? 0;
      return order === "asc" ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });

    const p = parseInt(page, 10), l = parseInt(limit, 10);
    const out = courses.slice((p - 1) * l, (p - 1) * l + l);

    res.json({
      success: true,
      data: {
        courses: out,
        pagination: { current: p, total: Math.ceil(courses.length / l), count: out.length, totalCourses: courses.length }
      }
    });
  } catch {
    res.status(500).json({ success: false, message: "Failed to fetch courses" });
  }
};

module.exports.removeCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const user = await userModel.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const exists = user.getEnrolledCourse(courseId);
    if (!exists) return res.status(404).json({ success: false, message: "Course not found in your profile" });

    await user.removeCourse(courseId);
    res.json({ success: true, message: "Course removed successfully" });
  } catch {
    res.status(500).json({ success: false, message: "Failed to remove course" });
  }
};

module.exports.updateCourseProgress = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { progress, isCompleted } = req.body;

    if (progress !== undefined && (typeof progress !== "number" || progress < 0 || progress > 100)) {
      return res.status(400).json({ success: false, message: "Progress must be a number between 0 and 100" });
    }

    const user = await userModel.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    await user.updateCourseProgress(courseId, progress, isCompleted);
    const updatedCourse = user.getEnrolledCourse(courseId);

    res.json({ success: true, message: "Course progress updated successfully", data: updatedCourse });
  } catch (error) {
    if (error?.message === "Course not found in enrolled courses") {
      return res.status(404).json({ success: false, message: "Course not found in your profile" });
    }
    res.status(500).json({ success: false, message: "Failed to update progress" });
  }
};

module.exports.checkCourseEnrollment = async (req, res) => {
  try {
    const { courseId } = req.params;
    const user = await userModel.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const enrollment = user.getEnrolledCourse(courseId);
    res.json({ success: true, isEnrolled: !!enrollment, enrollment: enrollment || null });
  } catch {
    res.status(500).json({ success: false, message: "Failed to check enrollment" });
  }
};
// controllers/user.controller.js
module.exports.recentUsers = async (req, res) => {
  try {
    const limit = Math.min(24, Math.max(1, parseInt(req.query.limit || "12", 10)));
    const rows = await require("../models/user.model")
      .find({})
      .select("_id email fullname avatar createdAt updatedAt")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // optional: mark isConnected for the requesting user
    const data = rows
      .filter(u => String(u._id) !== String(req.user?._id))
      .map(u => ({
        ...u,
        name: u.fullname?.firstname
          ? `${u.fullname.firstname} ${u.fullname.lastname || ""}`.trim()
          : undefined,
        isConnected: Array.isArray(req.user?.connections)
          ? req.user.connections.some(id => String(id) === String(u._id))
          : false,
      }));

    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to load recent users" });
  }
};
