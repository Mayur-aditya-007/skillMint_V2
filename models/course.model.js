// models/course.model.js
const mongoose = require("mongoose");

const LectureSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true },
    videoUrl: { type: String, trim: true },
  },
  { _id: false }
);

const ResourcesSchema = new mongoose.Schema(
  {
    books:       { type: [String], default: [] },
    cheatsheets: { type: [String], default: [] },
    links:       { type: [String], default: [] },
  },
  { _id: false }
);

const ExpertConnectionSchema = new mongoose.Schema(
  {
    requestUrl: { type: String, trim: true },
  },
  { _id: false }
);

const ChatRoomSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true },
  },
  { _id: false }
);

const CourseSchema = new mongoose.Schema(
  {
    // Frontend also passes/stores a UUID-like "courseId"
    courseId: { type: String, index: true },

    // Primary display fields
    name:      { type: String, required: true, trim: true },
    thumbnail: { type: String, trim: true, default: "" },
    about:     { type: String, trim: true, default: "" },

    // Content structure (match exactly what UI reads)
    lectures:      { type: [LectureSchema], default: [] },
    resources:     { type: ResourcesSchema, default: () => ({}) },
    requirements:  { type: [String], default: [] },
    assignments:   { type: [String], default: [] },
    tests:         { type: [String], default: [] },
    viva:          { type: [String], default: [] },
    expertConnection: { type: ExpertConnectionSchema, default: () => ({}) },
    chatRoom:         { type: ChatRoomSchema, default: () => ({}) },
    // models/course.model.js (add these inside CourseSchema definition)
category: { type: String, trim: true, default: "general", index: true },
level: { type: String, trim: true, default: "beginner" },

  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform(_, ret) {
        // expose "id" as string, hide Mongo internals
        ret.id = ret._id.toString();
        delete ret._id;
        return ret;
      },
    },
  }
);

// helpful indexes for search/sort
CourseSchema.index({ name: "text", about: "text" });
CourseSchema.index({ courseId: 1 });

const collection = process.env.COURSES_COLLECTION || "courses";
module.exports = mongoose.model("Course", CourseSchema, collection);
