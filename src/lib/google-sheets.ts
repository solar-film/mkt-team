import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// The spreadsheet ID provided by the user
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || '1t0SA9gkJuQjvJbq1iPtAyWPqkX2NeLgtUI4DagU_K0U';

// Initialize auth
const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  // Private key needs to handle newline characters properly
  key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
  ],
});

export const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);

let initialized = false;

export async function initDoc() {
  if (!initialized) {
    try {
      await doc.loadInfo(); // loads document properties and worksheets
      initialized = true;
    } catch (error) {
      console.error('Failed to load Google Sheet info. Ensure credentials are correct and sheet is shared with the service account email.', error);
      throw error;
    }
  }
  return doc;
}

// Helper to generate a simple unique ID (since we don't have cuid() from prisma)
export function generateId() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}
