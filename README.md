# Google Sheets Monitor 2 (Drive API + Sheets API)

A programmatic event-driven solution that monitors Google Sheets using **Google Drive API watch notifications** and **Google Sheets API** for fetching data. No Apps Script required!

## Architecture

- **Google Drive API Watch**: Sets up push notifications when the file changes
- **Webhook Server**: Receives notifications from Google Drive
- **Google Sheets API**: Fetches sheet data when changes are detected
- **Change Detection**: Compares previous and current states to identify specific changes

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Get Google Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable **Google Drive API** and **Google Sheets API**
4. Create a **Service Account**
5. Download the JSON key file
6. **Share your Google Sheet** with the service account email (found in the JSON file)

### 3. Configure Environment

Create a `.env` file:

```env
GOOGLE_SERVICE_ACCOUNT_KEY=./path/to/service-account-key.json
SPREADSHEET_ID=your-spreadsheet-id-here
WEBHOOK_PORT=3001
WEBHOOK_URL=https://your-public-url.com
CHANNEL_ID=channel-12345
CHANNEL_TOKEN=token-12345
```

**For local development with ngrok:**
```env
WEBHOOK_URL=https://your-ngrok-url.ngrok.io
```

### 4. Set Up Drive Watch

Run the setup script to create a watch channel:

```bash
npm run setup
```

This will:
- Create a watch channel on your Google Sheet
- Set up push notifications to your webhook URL
- The watch expires in 7 days (re-run setup to renew)

### 5. Start the Webhook Server

```bash
npm run dev
```

The server will:
- Fetch initial sheet state
- Listen for Drive API notifications
- Fetch sheet data when changes are detected
- Display detailed change information

## How It Works

1. **Drive Watch Setup**: Creates a watch channel that notifies your server when the file changes
2. **Notification Received**: Google sends HTTP POST to `/drive-notification` when sheet changes
3. **Fetch Current State**: Server fetches current sheet data using Sheets API
4. **Compare States**: Compares with previous state to detect specific changes
5. **Display Changes**: Shows detailed information about edits, row additions/deletions

## What It Monitors

- **EDIT**: Cell value changes (shows old → new value, cell address)
- **INSERT_ROW**: New rows added (shows row index and inserted data)
- **REMOVE_ROW**: Rows deleted (shows row index and deleted data)
- **INSERT_COLUMN**: Columns added
- **REMOVE_COLUMN**: Columns removed

## Example Output

```
📝 Detected 1 change(s):

Change 1:
  Type: EDIT
  Sheet: Sheet1
  Range: B3
  Time: 1/15/2024, 10:30:00 AM
  Cell: B3
  Old Value: John
  New Value: John Doe

────────────────────────────────────────────────────────────────────────────────
```

## Important Notes

### Watch Expiration
- Drive API watch channels expire after **7 days maximum**
- Re-run `npm run setup` to renew the watch
- Consider setting up a cron job to auto-renew

### Webhook Requirements
- Your webhook URL must be **publicly accessible** (HTTPS)
- Use ngrok or similar for local development
- The server must respond within **200ms** to Google's notification

### Service Account Permissions
- Service account needs **Viewer** access to the sheet
- Share the sheet with the service account email address
- No user authorization needed (unlike Apps Script)

## Comparison with Apps Script Approach

| Feature | Drive API + Sheets API | Apps Script |
|---------|----------------------|--------------|
| **Setup** | Programmatic, no manual steps | Requires manual script installation |
| **Authorization** | Service account (automatic) | User authorization required |
| **Real-time** | Yes (push notifications) | Yes (triggers) |
| **Change Details** | Requires state comparison | Direct from event object |
| **Maintenance** | Watch renewal every 7 days | One-time setup |
| **No Code in Sheet** | ✅ Yes | ❌ No (script in sheet) |

## Troubleshooting

- **No notifications received**: 
  - Verify webhook URL is publicly accessible
  - Check that watch was set up successfully
  - Ensure service account has access to the sheet

- **Watch expired**: 
  - Re-run `npm run setup` to create a new watch

- **Changes not detected**: 
  - Check that initial state was captured
  - Verify service account has read access
  - Check server logs for errors

## Stopping the Watch

To stop receiving notifications, you can:
1. Stop the server
2. The watch will automatically expire after 7 days
3. Or manually stop using the Drive API (requires storing resource ID)

