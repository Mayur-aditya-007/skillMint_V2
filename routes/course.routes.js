// routes/course.routes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/course.controller");

// Order: specific first
router.get("/related", ctrl.related);
router.get("/categories", ctrl.categories);
router.get("/", ctrl.list);

router.get("/:id", ctrl.getOne);
router.post("/", ctrl.create);
router.patch("/:id", ctrl.update);
router.delete("/:id", ctrl.remove);

module.exports = router;
