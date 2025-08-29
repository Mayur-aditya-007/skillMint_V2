require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const app = require("./app");
const connectDB = require("./db/db"); // your existing DB connector

const PORT = process.env.PORT || 4000;

(async () => {
  await connectDB();

  const server = http.createServer(app);

  const io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || "http://localhost:5173",
      credentials: true,
    },
    path: "/socket.io",
    transports: ["websocket", "polling"],
  });

  // make io available in controllers
  app.set("io", io);

  // Auth for sockets (token from auth or query)
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token ||
        (socket.handshake.headers?.authorization || "").replace(/^Bearer\s+/i, "");

      if (!token) return next(); // allow anonymous (won't join room)
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = String(payload.id || payload._id);
      next();
    } catch (e) {
      // don’t hard-fail; just continue as anon
      next();
    }
  });

  io.on("connection", (socket) => {
    console.log("✅ socket connected:", socket.id, "user:", socket.userId ? socket.userId : "(anon)");

    // Join per-user room so messages deliver reliably
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
      // presence example (optional)
      io.emit("presence:update", { userId: socket.userId, online: true });
    }

    socket.on("disconnect", () => {
      if (socket.userId) {
        io.emit("presence:update", { userId: socket.userId, online: false });
      }
    });
  });

  server.listen(PORT, () => {
    console.log(`🚀 API + Socket.IO on http://localhost:${PORT}`);
    console.log(`CORS origin: ${process.env.CORS_ORIGIN || "http://localhost:5173"}`);
  });
})();
