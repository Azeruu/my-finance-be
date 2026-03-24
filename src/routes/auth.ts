import { Hono } from 'hono'
import { authMiddleware } from '../middlewares/auth.ts'
import { prisma } from '../db.ts'
import { createSheetForUser } from '../services/googleSheets.ts'

const authRoutes = new Hono<{ Variables: { userId: string, userEmail: string, userName: string }}>()

authRoutes.get('/me', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, avatar: true },
  })
  if (!user) return c.json({ error: 'User not found' }, 404)
  return c.json(user)
})

authRoutes.get('/google-sheet-url', authMiddleware, async (c) => {
  const userId = c.get('userId')
  let user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return c.json({ error: 'User not found' }, 404)

  if (!user.googleSheetId) {
    console.log(`User ${user.email} requested sheet but doesn't have one. Creating now...`)
    const sheetId = await createSheetForUser(user.name || 'User', user.email)
    if (sheetId) {
      user = await prisma.user.update({
        where: { id: userId },
        data: { googleSheetId: sheetId }
      })
    } else {
      return c.json({ error: 'Gagal membuat spreadsheet otomatis.' }, 500)
    }
  }

  return c.json({ url: `https://docs.google.com/spreadsheets/d/${user.googleSheetId}` })
})

authRoutes.post('/google-sheet-id', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const { sheetId } = await c.req.json()

  if (!sheetId) return c.json({ error: 'ID Spreadsheet wajib diisi' }, 400)

  let finalId = sheetId
  const match = sheetId.match(/\/d\/([a-zA-Z0-9-_]+)/)
  if (match) finalId = match[1]

  await prisma.user.update({
    where: { id: userId },
    data: { googleSheetId: finalId }
  })

  return c.json({ success: true, sheetId: finalId })
})

export default authRoutes
