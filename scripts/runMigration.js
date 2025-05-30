// scripts/runMigration.js
// Node.js script to run the JavaScript migration 
// Usage: node scripts/runMigration.js [userId]

const { main } = require('./migrateToFirestore');

async function runMigration() {
  const userId = process.argv[2]; // Optional user ID from command line
  
  console.log('🚀 Starting Trip Migration to Firestore...\n');
  
  try {
    // Set the userId as a command line argument for the migration script
    process.argv[2] = userId;
    await main();
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
