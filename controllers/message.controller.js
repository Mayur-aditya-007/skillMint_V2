// backend/controllers/message.controller.js
const mongoose = require("mongoose");
const Message = require("../models/message.model");
const User = mongoose.model("User");

const isId = (v) => {
  try { return mongoose.Types.ObjectId.isValid(v); } catch { return false; }
};

// shape helper – ALWAYS return same keys/types
const toDTO = (doc, viewerId = null) => ({
  _id: String(doc._id),
  senderId: String(doc.sender),
  receiverId: String(doc.receiver),
  content: doc.content,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
  read: !!doc.read,
  isMine: viewerId ? String(doc.sender) === String(viewerId) : undefined,
});

const getReceiverFromBody = (body = {}) =>
  body.to || body.receiverId || body.receiver || body.userId || null;

/** POST /api/messages  (also alias /api/messages/send) */
exports.sendMessage = async (req, res) => {
  try {
    const senderId = req.user._id;
    const receiverId = getReceiverFromBody(req.body);
    const content = (req.body?.content || "").toString().trim();

    if (!receiverId || !isId(receiverId)) {
      return res.status(400).json({ message: "Invalid receiver id" });
    }
    if (!content) return res.status(400).json({ message: "Content required" });

    const msg = await Message.create({ sender: senderId, receiver: receiverId, content });
    const dto = toDTO(msg, senderId);

    // realtime fanout
    const io = req.app.get("io");
    if (io) {
      io.to(`user:${String(senderId)}`).emit("message:new", { message: dto });
      io.to(`user:${String(receiverId)}`).emit("message:new", { message: dto });
    }

    return res.status(201).json(dto);
  } catch (e) {
    console.error("[messages.send] error:", e);
    return res.status(500).json({ message: "Failed to send message" });
  }
};

/** GET /api/messages/threads */
exports.getThreads = async (req, res) => {
  try {
    const viewer = req.user._id;

    const rows = await Message.aggregate([
      { $match: { $or: [{ sender: viewer }, { receiver: viewer }] } },
      { $sort: { createdAt: -1 } },
      { $addFields: { peer: { $cond: [{ $eq: ["$sender", viewer] }, "$receiver", "$sender"] } } },
      { $group: {
          _id: "$peer",
          lastMessage: { $first: "$$ROOT" },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$receiver", viewer] }, { $eq: ["$read", false] }] },
                1, 0
              ]
            }
          },
      }},
      { $sort: { "lastMessage.createdAt": -1 } },
      { $limit: 100 },
    ]);

    const peerIds = rows.map(r => r._id);
    const users = await User.find({ _id: { $in: peerIds } })
      .select("_id name email avatar")
      .lean();
    const map = new Map(users.map(u => [String(u._id), u]));

    const threads = rows.map(r => ({
      peer: map.get(String(r._id)) || { _id: r._id },
      lastMessage: toDTO(r.lastMessage, viewer),
      unreadCount: r.unreadCount,
    }));

    return res.json(threads);
  } catch (e) {
    console.error("[messages.threads] error:", e);
    return res.status(500).json({ message: "Failed to load threads" });
  }
};

/** GET /api/messages/:peerId   (alias of /api/messages/conversation/:userId) */
exports.getConversation = async (req, res) => {
  try {
    const viewer = req.user._id;
    const paramId = req.params.peerId || req.params.userId;
    if (!paramId || !isId(paramId)) {
      return res.status(400).json({ message: "Invalid peer id" });
    }

    const limit = Math.min(100, parseInt(req.query.limit || "30", 10));
    const cursor = req.query.cursor;

    const peer = new mongoose.Types.ObjectId(paramId);
    const base = {
      $or: [
        { sender: viewer, receiver: peer },
        { sender: peer,   receiver: viewer },
      ],
    };
    const q = cursor && isId(cursor)
      ? { ...base, _id: { $lt: new mongoose.Types.ObjectId(cursor) } }
      : base;

    const docs = await Message.find(q).sort({ _id: -1 }).limit(limit).lean();
    const items = docs.reverse().map(d => toDTO(d, viewer));

    // mark messages to viewer as read (best-effort)
    const unreadIds = docs
      .filter(d => String(d.receiver) === String(viewer) && !d.read)
      .map(d => d._id);
    if (unreadIds.length) {
      await Message.updateMany({ _id: { $in: unreadIds } }, { $set: { read: true } });
    }

    const nextCursor = docs.length === limit ? String(docs[docs.length - 1]._id) : null;
    return res.json({ messages: items, nextCursor });
  } catch (e) {
    console.error("[messages.conversation] error:", e);
    return res.status(500).json({ message: "Failed to load conversation" });
  }
};
