// routes/user.routes.js
const express = require("express");
const { body } = require("express-validator");
const router = express.Router();

const userController = require("../controllers/user.controller");
const { authUser } = require("../middleware/auth.middleware");

// -------- auth --------
router.post(
  "/register",
  [
    body("email").isEmail().withMessage("Invalid Email"),
    body("fullname.firstname").isLength({ min: 3 }).withMessage("First name must be at least 3 characters long"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters long"),
  ],
  userController.registerUser
);

router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Invalid Email"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters long"),
  ],
  userController.loginUser
);

router.get("/profile", authUser, userController.getUserProfile);
router.post("/logout", authUser, userController.logoutUser);
router.get("/me", authUser, userController.getUserProfile);

// -------- connect/search/profile --------
router.get("/search", authUser, userController.searchUsers);           // GET /user/search?q=...
router.get("/:id", authUser, userController.getUserByIdPublic);        // GET /user/:id (auth optional in code path)
router.post("/connect/:id", authUser, userController.toggleConnect);   // POST /user/connect/:id

// -------- courses management --------
router.post(
  "/courses/add",
  [
    authUser,
    body().custom((value, { req }) => {
      const c = req.body.course || req.body;
      if (!c) throw new Error("Missing course payload");
      const id = c.id || c._id || c.courseId;
      const name = c.name || c.title;
      if (!id) throw new Error("Course id/_id/courseId is required");
      if (!name) throw new Error("Course name/title is required");
      return true;
    }),
  ],
  userController.addCourse
);

router.get("/courses/my-courses", authUser, userController.getUserCourses);
router.delete("/courses/remove/:courseId", authUser, userController.removeCourse);
router.patch(
  "/courses/progress/:courseId",
  [
    authUser,
    body("progress").optional().isInt({ min: 0, max: 100 }).withMessage("Progress must be between 0 and 100"),
    body("isCompleted").optional().isBoolean().withMessage("isCompleted must be boolean"),
  ],
  userController.updateCourseProgress
);
router.get("/courses/check/:courseId", authUser, userController.checkCourseEnrollment);
// routes/user.routes.js
router.get("/recent", authUser, userController.recentUsers);

module.exports = router;
