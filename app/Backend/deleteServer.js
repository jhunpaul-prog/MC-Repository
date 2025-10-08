// app/Backend/deleteServer.js - Express server for user deletion
import express from 'express';
import admin from 'firebase-admin';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin SDK
// You'll need to download your service account key from Firebase Console
// Go to: Project Settings > Service Accounts > Generate New Private Key
// Try to load service account key, if not available, use default credentials
let serviceAccount;
try {
  serviceAccount = JSON.parse(fs.readFileSync(path.join(__dirname, 'serviceAccountKey.json'), 'utf8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://repository-c121e-default-rtdb.firebaseio.com'
  });
  console.log('✅ Firebase Admin initialized with service account key');
} catch (error) {
  console.warn('⚠️ Service account key not found, trying default credentials...');
  try {
    // Try to use default credentials (if running on Google Cloud or with gcloud auth)
    admin.initializeApp({
      databaseURL: 'https://repository-c121e-default-rtdb.firebaseio.com'
    });
    console.log('✅ Firebase Admin initialized with default credentials');
  } catch (defaultError) {
    console.error('❌ Failed to initialize Firebase Admin:', defaultError.message);
    console.log('📋 Please either:');
    console.log('   1. Add serviceAccountKey.json file, or');
    console.log('   2. Run: gcloud auth application-default login');
    process.exit(1);
  }
}

const app = express();
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'], // Add your domains
  credentials: true
}));
app.use(express.json());

// Delete user endpoint
app.post('/api/delete-user', async (req, res) => {
  try {
    const { uid, adminToken } = req.body;
    
    // Simple admin verification (you can improve this)
    if (!adminToken || adminToken !== 'your-secure-admin-token') {
      return res.status(401).json({ 
        error: 'Unauthorized - Invalid admin token' 
      });
    }
    
    if (!uid) {
      return res.status(400).json({ 
        error: 'Missing uid parameter' 
      });
    }
    
    const db = admin.database();
    let dbDeleted = false;
    let authDeleted = false;
    let error = null;
    
    try {
      // Delete from Realtime Database
      await db.ref(`users/${uid}`).remove();
      dbDeleted = true;
      console.log(`✅ Deleted user ${uid} from Realtime Database`);
      
      // Delete from Firebase Authentication
      await admin.auth().deleteUser(uid);
      authDeleted = true;
      console.log(`✅ Deleted user ${uid} from Firebase Authentication`);
      
      res.json({
        ok: true,
        dbDeleted,
        authDeleted,
        message: 'User successfully deleted from both Firebase Auth and Realtime Database'
      });
      
    } catch (deleteError) {
      console.error('Deletion error:', deleteError);
      error = deleteError.message;
      
      res.json({
        ok: false,
        dbDeleted,
        authDeleted,
        error: error
      });
    }
    
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Delete server is running' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Delete server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🗑️  Delete endpoint: http://localhost:${PORT}/api/delete-user`);
});
