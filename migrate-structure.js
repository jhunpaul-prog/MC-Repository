#!/usr/bin/env node

/**
 * Migration Script for SWU Medical Repository
 * This script helps migrate files from the old structure to the new organized structure
 */

const fs = require('fs');
const path = require('path');

// Migration mappings
const migrations = [
  // Auth pages
  {
    from: 'app/pages/Login.tsx',
    to: 'src/app/pages/auth/Login.tsx'
  },
  {
    from: 'app/pages/Verify.tsx',
    to: 'src/app/pages/auth/Verify.tsx'
  },
  {
    from: 'app/pages/ForgetPassword.tsx',
    to: 'src/app/pages/auth/ForgetPassword.tsx'
  },
  {
    from: 'app/pages/ConfirmForgetPassword.tsx',
    to: 'src/app/pages/auth/ConfirmForgetPassword.tsx'
  },
  {
    from: 'app/pages/ResetPassword.tsx',
    to: 'src/app/pages/auth/ResetPassword.tsx'
  },
  {
    from: 'app/pages/CreateAccount.tsx',
    to: 'src/app/pages/auth/CreateAccount.tsx'
  },

  // Admin pages
  {
    from: 'app/pages/Admin/AdminDashboard.tsx',
    to: 'src/app/pages/admin/AdminDashboard.tsx'
  },
  {
    from: 'app/pages/Admin/CreateAccountAdmin.tsx',
    to: 'src/app/pages/admin/CreateAccountAdmin.tsx'
  },
  {
    from: 'app/pages/Admin/upload/UploadResearch.tsx',
    to: 'src/app/pages/admin/upload/UploadResearch.tsx'
  },
  {
    from: 'app/pages/Admin/upload/UploadDetails.tsx',
    to: 'src/app/pages/admin/upload/UploadDetails.tsx'
  },
  {
    from: 'app/pages/Admin/upload/UploadMetaData.tsx',
    to: 'src/app/pages/admin/upload/UploadMetaData.tsx'
  },
  {
    from: 'app/pages/Admin/upload/ManageResources/ManageResearch.tsx',
    to: 'src/app/pages/admin/upload/ManageResearch.tsx'
  },

  // Admin settings
  {
    from: 'app/pages/Admin/Settings/MVP/MissionVisionModal.tsx',
    to: 'src/app/pages/admin/settings/MissionVisionModal.tsx'
  },
  {
    from: 'app/pages/Admin/Settings/MVP/Department.tsx',
    to: 'src/app/pages/admin/settings/Department.tsx'
  },
  {
    from: 'app/pages/Admin/Settings/MVP/PoliciesGuidelines.tsx',
    to: 'src/app/pages/admin/settings/PoliciesGuidelines.tsx'
  },

  // Admin upload types
  {
    from: 'app/pages/Admin/upload/ConferencePaper/ConferencePaperUpload.tsx',
    to: 'src/app/pages/admin/upload/ConferencePaper/ConferencePaperUpload.tsx'
  },
  {
    from: 'app/pages/Admin/upload/ConferencePaper/ConferenceDetails.tsx',
    to: 'src/app/pages/admin/upload/ConferencePaper/ConferenceDetails.tsx'
  },
  {
    from: 'app/pages/Admin/upload/ConferencePaper/ConferenceMetadata.tsx',
    to: 'src/app/pages/admin/upload/ConferencePaper/ConferenceMetadata.tsx'
  },
  {
    from: 'app/pages/Admin/upload/ConferencePaper/ViewResearch.tsx',
    to: 'src/app/pages/admin/upload/ConferencePaper/ViewResearch.tsx'
  },

  // Resident Doctor pages
  {
    from: 'app/pages/ResidentDoctor/RDDashboard.tsx',
    to: 'src/app/pages/resident-doctor/RDDashboard.tsx'
  },
  {
    from: 'app/pages/ResidentDoctor/About/About.tsx',
    to: 'src/app/pages/resident-doctor/about/About.tsx'
  },
  {
    from: 'app/pages/ResidentDoctor/Settings/AccountSettings.tsx',
    to: 'src/app/pages/resident-doctor/settings/AccountSettings.tsx'
  },
  {
    from: 'app/pages/ResidentDoctor/Settings/SavedList.tsx',
    to: 'src/app/pages/resident-doctor/settings/SavedList.tsx'
  },
  {
    from: 'app/pages/ResidentDoctor/Settings/Stats.tsx',
    to: 'src/app/pages/resident-doctor/settings/Stats.tsx'
  },
  {
    from: 'app/pages/ResidentDoctor/Settings/UserResearch.tsx',
    to: 'src/app/pages/resident-doctor/settings/UserResearch.tsx'
  },
  {
    from: 'app/pages/ResidentDoctor/Search/SearchResults.tsx',
    to: 'src/app/pages/resident-doctor/search/SearchResults.tsx'
  },
  {
    from: 'app/pages/ResidentDoctor/Search/components/ViewResearch.tsx',
    to: 'src/app/pages/resident-doctor/search/ViewResearch.tsx'
  },

  // Super Admin pages
  {
    from: 'app/pages/SuperAdmin/SuperAdminDashboard.tsx',
    to: 'src/app/pages/super-admin/SuperAdminDashboard.tsx'
  },
  {
    from: 'app/pages/SuperAdmin/Create.tsx',
    to: 'src/app/pages/super-admin/Create.tsx'
  },
  {
    from: 'app/pages/SuperAdmin/SuperSettings.tsx',
    to: 'src/app/pages/super-admin/SuperSettings.tsx'
  },

  // Route files
  {
    from: 'app/routes/home.tsx',
    to: 'src/app/routes/home.tsx'
  },
  {
    from: 'app/routes/login.tsx',
    to: 'src/app/routes/login.tsx'
  },
  {
    from: 'app/routes/admin.tsx',
    to: 'src/app/routes/admin.tsx'
  },
  {
    from: 'app/routes/RD.tsx',
    to: 'src/app/routes/RD.tsx'
  },
  {
    from: 'app/routes/Sa.tsx',
    to: 'src/app/routes/Sa.tsx'
  }
];

function ensureDirectoryExists(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  }
}

function migrateFile(from, to) {
  try {
    if (fs.existsSync(from)) {
      ensureDirectoryExists(to);
      
      // Read the file content
      let content = fs.readFileSync(from, 'utf8');
      
      // Update import paths (basic replacements)
      content = content.replace(/\.\.\/\.\.\/\.\.\/Backend\/firebase/g, '~/config/firebase');
      content = content.replace(/\.\.\/\.\.\/Backend\/firebase/g, '~/config/firebase');
      content = content.replace(/\.\.\/Backend\/firebase/g, '~/config/firebase');
      
      // Write to new location
      fs.writeFileSync(to, content);
      console.log(`✅ Migrated: ${from} → ${to}`);
      
      return true;
    } else {
      console.log(`⚠️  Source file not found: ${from}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error migrating ${from}:`, error.message);
    return false;
  }
}

function main() {
  console.log('🚀 Starting migration to new project structure...\n');
  
  let successCount = 0;
  let totalCount = migrations.length;
  
  migrations.forEach(migration => {
    if (migrateFile(migration.from, migration.to)) {
      successCount++;
    }
  });
  
  console.log(`\n📊 Migration Summary:`);
  console.log(`✅ Successful: ${successCount}/${totalCount}`);
  console.log(`❌ Failed: ${totalCount - successCount}/${totalCount}`);
  
  if (successCount === totalCount) {
    console.log('\n🎉 All files migrated successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Test the application to ensure everything works');
    console.log('2. Update any remaining import paths manually');
    console.log('3. Remove old files once you\'re confident everything works');
    console.log('4. Update the tsconfig.json paths if needed');
  } else {
    console.log('\n⚠️  Some files failed to migrate. Please check the errors above.');
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  main();
}

module.exports = { migrations, migrateFile };
