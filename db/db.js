const mongoose = require("mongoose");

module.exports = async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI missing");
  await mongoose.connect(uri, { dbName: process.env.DB_NAME });
  console.log("✅ Mongo connected:", process.env.DB_NAME);
};
