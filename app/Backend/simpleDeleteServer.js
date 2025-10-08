// app/Backend/simpleDeleteServer.js - Simple server for user deletion using Firebase REST API
import express from "express";
import cors from "cors";

const app = express();
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
  })
);
app.use(express.json());

// Firebase project configuration
const FIREBASE_PROJECT_ID = "repository-c121e";
const FIREBASE_API_KEY = "AIzaSyA2vECn1EZMHQSpmalm2HT3tGyl4yqNWX4"; // From your firebase config

// Delete user endpoint using Firebase REST API
app.post("/api/delete-user", async (req, res) => {
  try {
    const { uid, adminToken } = req.body;

    // Simple admin verification
    if (!adminToken || adminToken !== "your-secure-admin-token") {
      return res.status(401).json({
        error: "Unauthorized - Invalid admin token",
      });
    }

    if (!uid) {
      return res.status(400).json({
        error: "Missing uid parameter",
      });
    }

    let dbDeleted = false;
    let authDeleted = false;
    let error = null;

    try {
      // Delete from Realtime Database using REST API
      const dbResponse = await fetch(
        `https://repository-c121e-default-rtdb.firebaseio.com/users/${uid}.json`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (dbResponse.ok) {
        dbDeleted = true;
        console.log(`✅ Deleted user ${uid} from Realtime Database`);
      } else {
        console.log(
          `⚠️ Database deletion returned status: ${dbResponse.status}`
        );
      }

      // Note: Firebase Auth deletion via REST API requires a custom token or service account
      // For now, we'll mark this as requiring manual deletion
      authDeleted = false;

      res.json({
        ok: dbDeleted,
        dbDeleted,
        authDeleted,
        message: dbDeleted
          ? "User deleted from Realtime Database. Firebase Auth deletion requires manual action in Firebase Console."
          : "Failed to delete user from database.",
      });
    } catch (deleteError) {
      console.error("Deletion error:", deleteError);
      error = deleteError.message;

      res.json({
        ok: false,
        dbDeleted,
        authDeleted,
        error: error,
      });
    }
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Simple delete server is running",
    timestamp: new Date().toISOString(),
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Simple delete server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🗑️  Delete endpoint: http://localhost:${PORT}/api/delete-user`);
  console.log(
    `⚠️  Note: Firebase Auth deletion requires manual action in Firebase Console`
  );
});
