import dotenv from 'dotenv';

dotenv.config();

export const config = {
  serviceAccountKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '',
  spreadsheetId: process.env.SPREADSHEET_ID || '',
  webhookPort: parseInt(process.env.WEBHOOK_PORT || '3001', 10),
  webhookUrl: process.env.WEBHOOK_URL || `http://localhost:${process.env.WEBHOOK_PORT || '3001'}`,
  channelId: process.env.CHANNEL_ID || `channel-${Date.now()}`,
  channelToken: process.env.CHANNEL_TOKEN || `token-${Date.now()}`,
};

if (!config.serviceAccountKey) {
  throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable is required');
}

if (!config.spreadsheetId) {
  throw new Error('SPREADSHEET_ID environment variable is required');
}

