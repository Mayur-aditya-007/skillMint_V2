// middleware/auth.middleware.js
const jwt = require("jsonwebtoken");
const userModel = require("../models/user.model");
const blackListTokenModel = require("../models/blackListToken.model");

/** Prefer header token; fallback to cookie */
function extractToken(req) {
  const auth = req.headers?.authorization || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  return req.cookies?.token || null;
}

module.exports.authUser = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ message: "Unauthorized: no token" });

    // Block revoked tokens
    const blacklisted = await blackListTokenModel.findOne({ token }).lean();
    if (blacklisted) return res.status(401).json({ message: "Unauthorized: token revoked" });

    // Verify JWT
    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ message: "Server misconfigured: missing JWT_SECRET" });

    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch {
      return res.status(401).json({ message: "Unauthorized: invalid or expired token" });
    }

    // Support different payload id keys
    const userId = decoded.id || decoded._id || decoded.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized: bad token payload" });

    // Load user (without password)
    const user = await userModel.findById(userId).select("-password");
    if (!user) return res.status(401).json({ message: "Unauthorized: user not found" });

    // Attach for downstream handlers
    req.user = user;
    req.auth = decoded;
    req.token = token;

    return next();
  } catch (err) {
    console.error("[authUser] error:", err);
    return res.status(401).json({ message: "Unauthorized" });
  }
};
