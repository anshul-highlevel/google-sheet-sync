import express, { Request, Response } from 'express';
import { SheetsClient } from './sheets-client';
import { ChangeDetector } from './change-detector';
import { config } from './config';
import { SheetData, ChangeEvent, DriveNotification } from './types';

const app = express();
app.use(express.json());

// Store previous sheet state
let previousSheetData: SheetData = {};
let isInitialized = false;

const sheetsClient = new SheetsClient();
const changeDetector = new ChangeDetector();

// Helper function for timestamped logging
function log(message: string, level: 'info' | 'warn' | 'error' = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : 'ℹ️';
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

// Initialize: Fetch initial sheet state
async function initialize() {
  try {
    log('📊 Starting initial sheet state fetch...');
    const startTime = Date.now();
    
    previousSheetData = await sheetsClient.getAllSheetData();
    
    const duration = Date.now() - startTime;
    const sheetCount = Object.keys(previousSheetData).length;
    const totalRows = Object.values(previousSheetData).reduce((sum, rows) => sum + rows.length, 0);
    
    log(`✅ Initial state captured successfully (${duration}ms)`);
    log(`   Sheets found: ${sheetCount}`);
    log(`   Total rows: ${totalRows}`);
    
    isInitialized = true;
    log('✅ Ready to monitor changes!');
    console.log('─'.repeat(80));
  } catch (error: any) {
    log(`Failed to initialize: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Webhook endpoint for Drive API notifications
app.post('/drive-notification', async (req: Request, res: Response) => {
  // Google Drive API sends notification data in HTTP headers, not body
  // Headers are lowercase in Express: 'x-goog-resource-state'
  const resourceState = req.headers['x-goog-resource-state'] as string;
  const channelId = req.headers['x-goog-channel-id'] as string;
  const resourceId = req.headers['x-goog-resource-id'] as string;
  const resourceUri = req.headers['x-goog-resource-uri'] as string;

  // Respond immediately to Google (within 200ms)
  res.status(200).send('OK');

  log(`📨 Drive API notification received (resourceState: ${resourceState || 'undefined'})`);
  log(`   Channel ID: ${channelId || 'not provided'}`);
  log(`   Resource ID: ${resourceId || 'not provided'}`);

  // Verify channel ID matches (security check)
  // Only validate if CHANNEL_ID is explicitly set in environment (not auto-generated)
  const channelIdFromEnv = process.env.CHANNEL_ID;
  if (channelIdFromEnv && channelId && channelId !== config.channelId) {
    log(`⚠️ Ignoring notification with mismatched channel ID: ${channelId} (expected: ${config.channelId})`, 'warn');
    return;
  } else if (channelIdFromEnv && channelId === config.channelId) {
    log(`✅ Channel ID verified: ${channelId}`);
  } else if (!channelIdFromEnv) {
    log(`ℹ️ Channel ID validation skipped (CHANNEL_ID not set in environment)`);
  }

  // Verify this is a valid notification
  // 'sync' = initial sync notification, 'update' = file changed
  if (resourceState === 'sync' || resourceState === 'update') {
    log(`🔄 Processing ${resourceState} notification...`);
    // Process the change asynchronously
    processChange().catch(error => {
      log(`Error processing change: ${error.message}`, 'error');
    });
  } else {
    log(`⚠️ Ignoring notification with resourceState: ${resourceState || 'undefined'}`, 'warn');
  }
});

// Process sheet changes
async function processChange() {
  try {
    log('📥 Fetching current sheet data...');
    const fetchStartTime = Date.now();
    
    // Fetch current sheet data
    const currentData = await sheetsClient.getAllSheetData();
    
    const fetchDuration = Date.now() - fetchStartTime;
    log(`✅ Sheet data fetched successfully (${fetchDuration}ms)`);

    // Only detect changes if we have a previous state
    if (isInitialized) {
      log('🔍 Detecting changes...');
      const detectStartTime = Date.now();
      
      const changes = changeDetector.detectChanges(previousSheetData, currentData);
      
      const detectDuration = Date.now() - detectStartTime;
      log(`✅ Change detection completed (${detectDuration}ms)`);

      if (changes.length > 0) {
        log(`📝 Found ${changes.length} change(s) - displaying details...`);
        displayChanges(changes);
      } else {
        log('ℹ️ No changes detected');
        console.log('─'.repeat(80));
      }
    } else {
      log('⚠️ Skipping change detection - not yet initialized', 'warn');
    }

    // Update previous state (always update, even if change detection failed)
    // This ensures we don't miss changes on subsequent notifications
    previousSheetData = currentData;
    if (!isInitialized) {
      isInitialized = true;
    }
    
    log('✅ Change processing completed');
  } catch (error: any) {
    log(`Error processing change: ${error.message}`, 'error');
  }
}

function displayChanges(changes: ChangeEvent[]) {
  console.log(`\n📝 Detected ${changes.length} change(s):\n`);

  changes.forEach((change, index) => {
    console.log(`Change ${index + 1}:`);
    console.log(`  Type: ${change.changeType}`);
    console.log(`  Sheet: ${change.sheetName}`);
    console.log(`  Range: ${change.affectedRange.a1Notation}`);
    console.log(`  Time: ${new Date(change.timestamp).toLocaleString()}`);

    if (change.changeType === 'EDIT') {
      console.log(`  Cell: ${change.cellAddress}`);
      console.log(`  Old Value: ${formatValue(change.oldValue)}`);
      console.log(`  New Value: ${formatValue(change.newValue)}`);
    } else if (change.changeType === 'INSERT_ROW') {
      console.log(`  Row Index: ${change.rowIndex}`);
      if (change.insertedData && change.insertedData.length > 0) {
        console.log(`  Inserted Data: ${JSON.stringify(change.insertedData[0])}`);
      }
    } else if (change.changeType === 'REMOVE_ROW') {
      console.log(`  Row Index: ${change.rowIndex}`);
      if (change.deletedData && change.deletedData.length > 0) {
        console.log(`  Deleted Data: ${JSON.stringify(change.deletedData[0])}`);
      }
    } else if (change.changeType === 'INSERT_COLUMN') {
      console.log(`  Column Index: ${change.columnIndex}`);
      if (change.insertedData && change.insertedData.length > 0) {
        console.log(`  Inserted Data: ${JSON.stringify(change.insertedData)}`);
      }
    } else if (change.changeType === 'REMOVE_COLUMN') {
      console.log(`  Column Index: ${change.columnIndex}`);
      if (change.deletedData && change.deletedData.length > 0) {
        console.log(`  Deleted Data: ${JSON.stringify(change.deletedData)}`);
      }
    }

    console.log('');
  });

  console.log('─'.repeat(80));
}

function formatValue(value: any): string {
  if (value === null || value === undefined) {
    return '(empty)';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok',
    initialized: isInitialized,
    spreadsheetId: config.spreadsheetId
  });
});

const PORT = config.webhookPort;

// Start server
app.listen(PORT, async () => {
  log('🚀 Webhook server starting...');
  console.log(`📡 Listening on port ${PORT}`);
  console.log(`🔗 Webhook URL: ${config.webhookUrl}/drive-notification`);
  console.log(`📊 Spreadsheet ID: ${config.spreadsheetId}\n`);

  // Initialize sheet state
  await initialize();
});

// Graceful shutdown
process.on('SIGINT', () => {
  log('🛑 Shutting down...');
  process.exit(0);
});

