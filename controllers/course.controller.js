// controllers/course.controller.js
const svc = require("../services/course.service");

// list
exports.list = async (req, res) => {
  try {
    const result = await svc.list(req.query);
    return res.status(200).json(result);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: 'Failed to list courses' });
  }
};

// related search chips
exports.related = async (req, res) => {
  try {
    const result = await svc.related(req.query);
    return res.status(200).json(result);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: 'Failed to load related searches' });
  }
};

// categories
exports.categories = async (_req, res) => {
  try {
    const result = await svc.categories();
    return res.status(200).json(result);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: 'Failed to load categories' });
  }
};

exports.getOne = async (req, res) => {
  try {
    const doc = await svc.getById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json(doc);
  } catch (e) {
    console.error("COURSE GETONE ERROR:", e);
    res.status(400).json({ error: "Invalid id" });
  }
};

exports.create = async (req, res) => {
  try { res.status(201).json(await svc.create(req.body)); }
  catch (e) {
    console.error("COURSE CREATE ERROR:", e);
    res.status(400).json({ error: e.message || "Create failed" });
  }
};

exports.update = async (req, res) => {
  try {
    const updated = await svc.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch (e) {
    console.error("COURSE UPDATE ERROR:", e);
    res.status(400).json({ error: e.message || "Update failed" });
  }
};

exports.remove = async (req, res) => {
  try {
    const del = await svc.remove(req.params.id);
    if (!del) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (e) {
    console.error("COURSE REMOVE ERROR:", e);
    res.status(400).json({ error: e.message || "Delete failed" });
  }
};
