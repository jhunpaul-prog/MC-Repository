const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Load the service account key
const keyPath = path.join(__dirname, 'ftwears-c94a9acc8f36.json');
const auth = new google.auth.GoogleAuth({
  keyFile: keyPath,
  scopes: ['https://www.googleapis.com/auth/drive.file'],
});

const uploadToDrive = async (filePath) => {
  const drive = google.drive({ version: 'v3', auth: await auth.getClient() });

  const res = await drive.files.create({
    requestBody: {
      name: 'conference_paper.pdf',
      mimeType: 'application/pdf',
    },
    media: {
      mimeType: 'application/pdf',
      body: fs.createReadStream(filePath),
    },
  });

  console.log('✅ Uploaded to Drive:', res.data);

  // Make public
  await drive.permissions.create({
    fileId: res.data.id,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });

  const link = `https://drive.google.com/file/d/${res.data.id}/view`;
  console.log('📎 Shareable Link:', link);
};
