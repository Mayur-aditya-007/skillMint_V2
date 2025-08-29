const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    sender:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    receiver:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    content:    { type: String, required: true, trim: true, maxlength: 5000 },
    read:       { type: Boolean, default: false, index: true },
    deletedFor: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  },
  { timestamps: true }
);

messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, read: 1 });

module.exports = mongoose.model("Message", messageSchema);
