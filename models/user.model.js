// backend/models/user.model.js
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

/* --------------------------- Subdocuments/Schemas -------------------------- */

const EnrolledCourseSchema = new mongoose.Schema(
  {
    courseId: { type: String, required: true },
    courseName: { type: String, required: true }, // note the key is courseName
    thumbnail: { type: String, default: "" },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    isCompleted: { type: Boolean, default: false },
    enrolledAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ReviewSchema = new mongoose.Schema(
  {
    rating: { type: Number, min: 1, max: 5, required: true },
    text: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

/* --------------------------------- User ----------------------------------- */

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    // keep password not returned by default; controller uses .select("+password") for login
    password: { type: String, required: true, select: false, minlength: 6 },
    fullname: {
      firstname: { type: String, default: "" },
      lastname: { type: String, default: "" },
    },
    avatar: { type: String, default: "" },

    // Social graph (for Connect feature)
    connections: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Reviews (if you attach reviews to user)
    reviews: { type: [ReviewSchema], default: [] },

    // Enrollments
    enrolledCourses: { type: [EnrolledCourseSchema], default: [] },
  },
  { timestamps: true }
);

/* ------------------------------ Indexes/Opts ------------------------------ */

UserSchema.index({ "fullname.firstname": 1 });
UserSchema.index({ "fullname.lastname": 1 });

UserSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.password;
    return ret;
  },
});

/* ----------------------------- Auth Utilities ----------------------------- */

// Hash password before save (only when modified/created)
UserSchema.pre("save", async function (next) {
  try {
    if (!this.isModified("password")) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    return next();
  } catch (e) {
    return next(e);
  }
});

// Compare a plaintext password against the hash
UserSchema.methods.comparePassword = function (candidate) {
  // When password is selected via .select("+password"), it's present as string
  if (typeof this.password !== "string") return Promise.resolve(false);
  return bcrypt.compare(String(candidate || ""), this.password);
};

// Backwards-compat alias if any code calls comparepassword
UserSchema.methods.comparepassword = UserSchema.methods.comparePassword;

// Issue a JWT for this user
UserSchema.methods.generateAuthToken = function () {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not set");
  }
  return jwt.sign(
    { id: this._id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
};

/* ------------------------- Enrolled Courses Helpers ------------------------ */

// Add or upsert a course to enrolledCourses
// payload: { courseId, name (or courseName), thumbnail }
UserSchema.methods.addCourse = async function ({ courseId, name, courseName, thumbnail = "" }) {
  if (!courseId || !(name || courseName)) {
    throw new Error("Course id and name are required");
  }
  const finalName = courseName || name;

  if (!Array.isArray(this.enrolledCourses)) this.enrolledCourses = [];

  const idx = this.enrolledCourses.findIndex((c) => String(c.courseId) === String(courseId));
  if (idx !== -1) {
    // already enrolled
    throw new Error("Course already enrolled");
  }

  this.enrolledCourses.push({
    courseId,
    courseName: finalName,
    thumbnail,
    progress: 0,
    isCompleted: false,
    enrolledAt: new Date(),
    updatedAt: new Date(),
  });

  await this.save();
  return this.getEnrolledCourse(courseId);
};

UserSchema.methods.getEnrolledCourse = function (courseId) {
  if (!Array.isArray(this.enrolledCourses)) return null;
  return this.enrolledCourses.find((c) => String(c.courseId) === String(courseId)) || null;
};

UserSchema.methods.removeCourse = async function (courseId) {
  if (!Array.isArray(this.enrolledCourses)) this.enrolledCourses = [];
  const before = this.enrolledCourses.length;
  this.enrolledCourses = this.enrolledCourses.filter((c) => String(c.courseId) !== String(courseId));
  if (this.enrolledCourses.length === before) {
    throw new Error("Course not found in enrolled courses");
  }
  await this.save();
};

UserSchema.methods.updateCourseProgress = async function (courseId, progress, isCompleted) {
  if (!Array.isArray(this.enrolledCourses)) this.enrolledCourses = [];
  const idx = this.enrolledCourses.findIndex((c) => String(c.courseId) === String(courseId));
  if (idx === -1) throw new Error("Course not found in enrolled courses");

  if (typeof progress === "number") {
    this.enrolledCourses[idx].progress = Math.max(0, Math.min(100, progress));
  }
  if (typeof isCompleted === "boolean") {
    this.enrolledCourses[idx].isCompleted = isCompleted;
  }
  this.enrolledCourses[idx].updatedAt = new Date();
  await this.save();
  return this.enrolledCourses[idx];
};

module.exports = mongoose.model("User", UserSchema);
