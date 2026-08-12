const sdk = require("node-appwrite");
const { createSessionClient } = require("../config/appwriteClient");

/**
 * Shared authentication middleware for Appwrite session validation.
 * Extracts session secret from Authorization Bearer header or "token" cookie,
 * validates against Appwrite account.get(), and attaches req.user and req.appwriteSession.
 */
const authMiddleware = async (req, res, next) => {
  try {
    let secret = req.headers.authorization
      ? req.headers.authorization.replace(/^Bearer\s+/i, "")
      : req.cookies ? req.cookies.token : undefined;

    if (!secret) {
      return res.status(401).json({ error: "Authentication token missing" });
    }

    const sessionClient = createSessionClient(secret);
    const sessionAccount = new sdk.Account(sessionClient);

    const accountResult = await sessionAccount.get();

    req.user = {
      id: accountResult.$id,
      email: accountResult.email,
      name: accountResult.name,
      createdAt: accountResult.$createdAt,
    };
    req.appwriteSession = secret;

    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
};

module.exports = authMiddleware;
