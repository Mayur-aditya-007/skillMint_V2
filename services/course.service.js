// services/course.service.js
const Course = require("../models/course.model");
const mongoose = require("mongoose");

function toInt(v, d) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; }

class CourseService {
  /**
   * Strict search + predictable sort + pagination.
   * Default: search in NAME only, so results are exactly what the user typed.
   * Optional: searchIn=all to include "about" too.
   */
  async list(query = {}) {
    const {
      q, search, category, level,
      page = 1, limit = 20,
      sortBy = "createdAt",        // "name" | "createdAt" | "price" | "rating" | "enrollmentCount"
      sortOrder = "desc",          // "asc" | "desc"
      searchIn = "name"            // "name" | "all"
    } = query;

    const term = (q ?? search ?? "").toString().trim();
    const pageNum = Math.max(1, toInt(page, 1));
    const limitNum = Math.min(100, Math.max(1, toInt(limit, 20)));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (term) {
      const rx = new RegExp(term, "i");
      filter.$or = searchIn === "all" ? [{ name: rx }, { about: rx }] : [{ name: rx }];
    }
    if (category && category !== "all") filter.category = category;
    if (level && level !== "all") filter.level = level;

    const allowed = new Set(["name", "createdAt", "price", "rating", "enrollmentCount"]);
    const field = allowed.has(String(sortBy)) ? String(sortBy) : "createdAt";
    const dir = String(sortOrder).toLowerCase() === "asc" ? 1 : -1;
    const sort = { [field]: dir };

    const collation = { locale: "en", strength: 2 }; // proper A→Z (case-insensitive)

    const [items, total] = await Promise.all([
      Course.find(filter).collation(collation).sort(sort).skip(skip).limit(limitNum).lean(),
      Course.countDocuments(filter),
    ]);

    return {
      success: true,
      data: {
        courses: items,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          hasNext: pageNum * limitNum < total,
          hasPrev: pageNum > 1,
        },
        filters: { search: term, category: category || "all", level: level || "all", sortBy: field, sortOrder: dir === 1 ? "asc" : "desc", searchIn },
      },
    };
  }

  /** Related searches: distinct names similar to the query (clickable chips) */
  async related(query = {}) {
    const { q, limit = 10 } = query;
    const term = (q || "").toString().trim();
    if (!term) return { success: true, data: [] };

    const limitNum = Math.min(20, Math.max(1, toInt(limit, 10)));
    const rx = new RegExp(term, "i");

    const rows = await Course.aggregate([
      { $match: { name: rx } },
      { $group: { _id: "$name", count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: limitNum },
      { $project: { _id: 0, name: "$_id", count: 1 } }
    ]).collation({ locale: "en", strength: 2 });

    return { success: true, data: rows };
  }

  async categories() {
    const rows = await Course.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    return { success: true, data: rows };
  }

  async getById(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const doc = await Course.findById(id).lean();
    return doc ? { success: true, data: doc } : null;
  }

  async create(payload) {
    if (!payload || !payload.name) throw new Error("`name` is required");
    const created = await Course.create(payload);
    return { success: true, data: created.toJSON() };
  }

  async update(id, patch) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const updated = await Course.findByIdAndUpdate(id, patch, { new: true }).lean();
    return updated ? { success: true, data: updated } : null;
  }

  async remove(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const del = await Course.findByIdAndDelete(id).lean();
    return del ? { success: true, data: del } : null;
  }
}

module.exports = new CourseService();
