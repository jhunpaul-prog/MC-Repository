// backend/server.js or resetLink.js
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.cert(require("./serviceAccountKey.json")),
});

const app = express();
app.use(cors());
app.use(express.json());

app.post("/generate-reset-link", async (req, res) => {
  const { email } = req.body;

  try {
    const link = await admin.auth().generatePasswordResetLink(email, {
      url: "http://localhost:5173/reset-password", // where the user will go
      handleCodeInApp: true,
    });

    res.status(200).json({ resetLink: link });
  } catch (error) {
    console.error("Error generating link:", error);
    res.status(500).json({ message: error.message });
  }
});

app.listen(4000, () => console.log("🔥 Server started on port 4000"));
