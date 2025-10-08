// app/Backend/getServiceAccount.js - Helper script to guide service account setup
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔥 Firebase Service Account Setup Helper\n');

const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

if (fs.existsSync(serviceAccountPath)) {
  console.log('✅ Service account key found!');
  console.log('📍 Location:', serviceAccountPath);
  
  try {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    console.log('✅ Valid JSON format');
    console.log('📧 Project ID:', serviceAccount.project_id);
    console.log('🔑 Client Email:', serviceAccount.client_email);
    
    if (serviceAccount.project_id === 'repository-c121e') {
      console.log('✅ Project ID matches your Firebase project!');
    } else {
      console.log('⚠️  Warning: Project ID does not match "repository-c121e"');
    }
    
  } catch (error) {
    console.log('❌ Invalid JSON file:', error.message);
  }
  
} else {
  console.log('❌ Service account key not found!');
  console.log('\n📋 To get your service account key:');
  console.log('1. Go to: https://console.firebase.google.com/');
  console.log('2. Select project: repository-c121e');
  console.log('3. Go to: Project Settings → Service Accounts');
  console.log('4. Click: "Generate new private key"');
  console.log('5. Download the JSON file');
  console.log('6. Rename it to: serviceAccountKey.json');
  console.log('7. Place it in: app/Backend/serviceAccountKey.json');
  console.log('\n📍 Expected location:', serviceAccountPath);
}

console.log('\n🚀 After setup, start the delete server with:');
console.log('   npm run delete-server');
console.log('\n🧪 Test the server with:');
console.log('   curl http://localhost:3001/api/health');
