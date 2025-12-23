import { DriveWatch } from './drive-watch';
import { config } from './config';
import dotenv from 'dotenv';

dotenv.config();

async function setup() {
  try {
    console.log('🔧 Setting up Drive API watch...\n');
    
    const driveWatch = new DriveWatch();
    const watchInfo = await driveWatch.setupWatch(config.webhookUrl);

    console.log('\n✅ Setup complete!');
    
    // Warn if CHANNEL_ID is not set in environment
    if (!process.env.CHANNEL_ID) {
      console.log('\n⚠️  WARNING: CHANNEL_ID not set in environment!');
      console.log(`   Add this to your .env file: CHANNEL_ID=${config.channelId}`);
      console.log('   Without it, channel ID validation will be skipped on server restart.');
    }
    
    console.log('\nNext steps:');
    console.log('1. Make sure your webhook server is running: npm run dev');
    console.log('2. Make sure your webhook URL is publicly accessible (use ngrok if local)');
    console.log('3. Share your Google Sheet with the service account email');
    console.log('4. Make a change to your sheet to test\n');
    
    console.log('Watch will expire in 7 days. Re-run this setup to renew.');
    console.log(`\nTo stop watching, save the resource ID: ${watchInfo.resourceId}`);
    
  } catch (error: any) {
    console.error(`❌ Setup failed: ${error.message}`);
    process.exit(1);
  }
}

setup();

