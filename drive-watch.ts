import { google } from 'googleapis';
import { config } from './config';
import fs from 'fs';

export class DriveWatch {
  private drive: any;
  private spreadsheetId: string;

  constructor() {
    this.spreadsheetId = config.spreadsheetId;
    this.initializeClient();
  }

  private initializeClient() {
    const keyFile = config.serviceAccountKey;
    const key = JSON.parse(fs.readFileSync(keyFile, 'utf8'));

    const auth = new google.auth.GoogleAuth({
      credentials: key,
      scopes: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.file',
      ],
    });

    this.drive = google.drive({ version: 'v3', auth });
  }

  async setupWatch(webhookUrl: string): Promise<any> {
    try {
      // Calculate expiration time (max 7 days from now)
      const expiration = Date.now() + (7 * 24 * 60 * 60 * 1000);

      const response = await this.drive.files.watch({
        fileId: this.spreadsheetId,
        requestBody: {
          id: config.channelId,
          type: 'web_hook',
          address: `${webhookUrl}/drive-notification`,
          expiration: expiration,
        },
      });

      console.log('✅ Drive watch channel created');
      console.log(`   Channel ID: ${config.channelId}`);
      console.log(`   Resource ID: ${response.data.resourceId}`);
      console.log(`   Expiration: ${new Date(expiration).toISOString()}`);
      
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to setup watch: ${error.message}`);
    }
  }

  async stopWatch(channelId: string, resourceId: string): Promise<void> {
    try {
      await this.drive.channels.stop({
        requestBody: {
          id: channelId,
          resourceId: resourceId,
        },
      });
      console.log('✅ Watch channel stopped');
    } catch (error: any) {
      console.error(`Failed to stop watch: ${error.message}`);
    }
  }
}

