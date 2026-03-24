import { Hono } from 'hono'
import { authMiddleware } from '../middlewares/auth.ts'
import { prisma } from '../db.ts'
import { z } from 'zod'
import { appendToSheet } from '../services/googleSheets.ts'

const recentExpenseSchema = z.object({
  name: z.string().min(1).max(100),
  amount: z.coerce.number().min(0),
  category: z.string().min(1).max(50),
  paymentMethod: z.string().min(1).max(50),
  date: z.string().datetime(), // Format ISO string dari frontend
})

const recentExpenseRoutes = new Hono<{ Variables: { userId: string }}>()
recentExpenseRoutes.use('*', authMiddleware)

recentExpenseRoutes.post('/', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json()

  const result = recentExpenseSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.format() }, 400)
  }

  const { name, amount, category, paymentMethod, date } = result.data
  const d = new Date(date)
  const month = d.getMonth() + 1
  const year = d.getFullYear()

  // Simpan ke RecentExpense (Tabel detail)
  const recentExpense = await prisma.recentExpense.create({
    data: { userId, name, amount, category, paymentMethod, month, year, createdAt: d }
  })

  // Simpan juga ke tabel Expense (hanya data relevan)
  await prisma.expense.create({
    data: { userId, name, amount, month, year, createdAt: d }
  })

  // Ambil user untuk mendapatkan googleSheetId
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { googleSheetId: true }
  })

  // Kirim ke Google Sheets
  // Format data: Tanggal, Nama, Jumlah, Kategori, Metode
  const day = String(d.getDate()).padStart(2, '0')
  const monthStr = String(d.getMonth() + 1).padStart(2, '0')
  const yearStr = d.getFullYear()
  const dateStr = `${day}/${monthStr}/${yearStr}`

  const sheetData = [ dateStr, name, amount, category, paymentMethod ]
  await appendToSheet(user?.googleSheetId || null, sheetData)

  return c.json(recentExpense)
})

export default recentExpenseRoutes
