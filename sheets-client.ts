import { google } from 'googleapis';
import { config } from './config';
import { SheetData } from './types';
import fs from 'fs';

export class SheetsClient {
  private sheets: any;
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
        'https://www.googleapis.com/auth/spreadsheets.readonly',
        'https://www.googleapis.com/auth/drive.readonly',
      ],
    });

    this.sheets = google.sheets({ version: 'v4', auth });
  }

  async getAllSheetData(): Promise<SheetData> {
    try {
      // Get all sheets in the spreadsheet
      const spreadsheet = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });

      const sheetData: SheetData = {};

      // Fetch data from each sheet
      for (const sheet of spreadsheet.data.sheets || []) {
        const sheetName = sheet.properties?.title || 'Sheet1';
        
        // Get all values from the sheet
        const response = await this.sheets.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          range: `${sheetName}!A:ZZZ`, // Get all columns
        });

        sheetData[sheetName] = response.data.values || [];
      }

      return sheetData;
    } catch (error: any) {
      throw new Error(`Failed to fetch sheet data: ${error.message}`);
    }
  }
}

