import { google as googleapis } from 'googleapis'

const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.replace(/^"|"$/g, '')
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/^"|"$/g, '')?.replace(/\\n/g, '\n')
const GOOGLE_SHEET_TEMPLATE_ID = process.env.GOOGLE_SHEET_TEMPLATE_ID?.replace(/^"|"$/g, '')

export async function createSheetForUser(userName: string, userEmail: string) {
  const auth = new googleapis.auth.GoogleAuth({
    credentials: {
      client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: GOOGLE_PRIVATE_KEY
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive']
  })

  // @ts-ignore
  const sheets = googleapis.sheets({ version: 'v4', auth })
  // @ts-ignore
  const drive = googleapis.drive({ version: 'v3', auth })

  try {
    console.log(`[ServiceAccount] Starting spreadsheet creation for user: ${userEmail}`)
    let spreadsheetId: string | null = null;
    
    if (GOOGLE_SHEET_TEMPLATE_ID) {
      console.log(`Copying from template: ${GOOGLE_SHEET_TEMPLATE_ID}`)
      const copyResponse = await drive.files.copy({
        fileId: GOOGLE_SHEET_TEMPLATE_ID,
        requestBody: { name: `Finance Manager - ${userName}` }
      })
      spreadsheetId = copyResponse.data.id || null;
    } else {
      const spreadsheet = await sheets.spreadsheets.create({
        requestBody: { properties: { title: `Finance Manager - ${userName}` } }
      })
      spreadsheetId = spreadsheet.data.spreadsheetId || null;
      if (spreadsheetId) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: 'Sheet1!A1',
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [['Tanggal', 'Nama', 'Jumlah', 'Kategori', 'Metode']] }
        })
      }
    }

    if (spreadsheetId) {
      console.log(`Sharing spreadsheet ${spreadsheetId} with ${userEmail}`)
      await drive.permissions.create({
        fileId: spreadsheetId,
        requestBody: { type: 'user', role: 'writer', emailAddress: userEmail },
        // @ts-ignore
        sendNotificationEmail: false
      })
    }
    return spreadsheetId
  } catch (error: any) {
    console.error('Error creating spreadsheet on user drive:', error.message)
    return null
  }
}

export async function appendToSheet(spreadsheetId: string | null, data: any[]) {
  if (!spreadsheetId) {
    console.warn('[Spreadsheet] Missing ID. Skipping.')
    return
  }

  const auth = new googleapis.auth.GoogleAuth({
    credentials: {
      client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: GOOGLE_PRIVATE_KEY
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  })
  
  // @ts-ignore
  const sheets = googleapis.sheets({ version: 'v4', auth })

  try {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId })
    const firstSheetName = spreadsheet.data.sheets?.[0]?.properties?.title || 'Sheet1'

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${firstSheetName}!A:E`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [data] }
    })
    console.log(`Successfully appended to Google Sheet ${spreadsheetId}`)
  } catch (error: any) {
    console.error('[Spreadsheet] Error appending:', error.message)
  }
}
