// app/Backend/server.js - Alternative server-side deletion endpoint
const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');

// Initialize Firebase Admin (you'll need to add your service account key)
// admin.initializeApp({
//   credential: admin.credential.cert(require('./path-to-service-account.json')),
//   databaseURL: 'https://repository-c121e-default-rtdb.firebaseio.com'
// });

const app = express();
app.use(cors());
app.use(express.json());

// Delete user endpoint
app.post('/delete-user', async (req, res) => {
  try {
    const { uid, adminToken } = req.body;
    
    // Verify admin token (you'll need to implement proper admin verification)
    if (!adminToken || adminToken !== 'your-admin-secret') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const db = admin.database();
    let dbDeleted = false;
    let authDeleted = false;
    
    try {
      // Delete from Realtime Database
      await db.ref(`users/${uid}`).remove();
      dbDeleted = true;
      
      // Delete from Firebase Auth
      await admin.auth().deleteUser(uid);
      authDeleted = true;
      
      res.json({
        ok: true,
        dbDeleted,
        authDeleted,
        message: 'User deleted successfully from both systems'
      });
    } catch (e) {
      res.json({
        ok: false,
        dbDeleted,
        authDeleted,
        error: e.message
      });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});