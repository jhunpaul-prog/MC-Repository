# 🔥 Firebase User Deletion Server Setup

This server enables automatic deletion of users from both Firebase Authentication and Realtime Database.

## 📋 Prerequisites

1. **Firebase Project** with Realtime Database and Authentication enabled
2. **Service Account Key** from Firebase Console
3. **Node.js** installed

## 🚀 Setup Instructions

### Step 1: Get Firebase Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `repository-c121e`
3. Go to **Project Settings** → **Service Accounts**
4. Click **"Generate new private key"**
5. Download the JSON file
6. Rename it to `serviceAccountKey.json`
7. Place it in `app/Backend/serviceAccountKey.json`

### Step 2: Install Dependencies

The required packages are already in your package.json:
- `express`
- `firebase-admin`
- `cors`

### Step 3: Start the Delete Server

```bash
# Start the delete server
npm run delete-server

# Or for development with auto-restart
npm run delete-server-dev
```

### Step 4: Test the Server

The server will run on `http://localhost:3001`

Test endpoints:
- Health check: `GET http://localhost:3001/api/health`
- Delete user: `POST http://localhost:3001/api/delete-user`

## 🔒 Security Configuration

### Update Admin Token

In `deleteServer.js`, change the admin token:

```javascript
// Change this line:
if (!adminToken || adminToken !== 'your-secure-admin-token') {

// To your secure token:
if (!adminToken || adminToken !== 'your-actual-secure-token-here') {
```

### Update Client Token

In `accountDeletion.ts`, update the token:

```javascript
// Change this line:
adminToken: 'your-secure-admin-token'

// To match your server token:
adminToken: 'your-actual-secure-token-here'
```

## 🧪 Testing the Complete Deletion

1. **Start the delete server**: `npm run delete-server`
2. **Start your React app**: `npm run dev`
3. **Try deleting a user** from the ManageAccount interface
4. **Check Firebase Console** to verify user is deleted from both:
   - Authentication → Users
   - Realtime Database → users/{uid}

## 🔄 How It Works

1. **Client calls delete function** in ManageAccount
2. **First tries Cloud Function** (if available)
3. **Falls back to Express server** (localhost:3001)
4. **Server deletes from both**:
   - Firebase Authentication
   - Realtime Database
5. **Returns success confirmation**

## 🚨 Troubleshooting

### Server won't start
- Check if port 3001 is available
- Verify `serviceAccountKey.json` exists
- Check Firebase project configuration

### Deletion fails
- Verify service account has proper permissions
- Check Firebase Console for errors
- Ensure user UID is correct

### CORS errors
- Verify your domain is in the CORS origin list
- Check server is running on correct port

## 📝 Environment Variables (Optional)

For production, use environment variables:

```javascript
// In deleteServer.js
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'your-secure-admin-token';
const PORT = process.env.PORT || 3001;
```

Create `.env` file:
```
ADMIN_TOKEN=your-super-secure-token-here
PORT=3001
```


