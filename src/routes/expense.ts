import { Hono } from 'hono'
import { authMiddleware } from '../middlewares/auth.ts'
import { prisma } from '../db.ts'
import { z } from 'zod'

const expenseSchema = z.object({
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2000).max(2100),
  name: z.string().min(1).max(100),
  amount: z.coerce.number().min(0),
})

const expenseRoutes = new Hono<{ Variables: { userId: string }}>()
expenseRoutes.use('*', authMiddleware)

expenseRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const { month, year } = c.req.query()
  if (!month || !year) return c.json({ error: 'Month and year required' }, 400)

  const expenses = await prisma.expense.findMany({
    where: { userId, month: parseInt(month), year: parseInt(year) },
    orderBy: { createdAt: 'desc' }
  })
  return c.json(expenses)
})

expenseRoutes.post('/', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json()

  const result = expenseSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.format() }, 400)
  }

  const { month, year, name, amount } = result.data

  const expense = await prisma.expense.create({
    data: { userId, month, year, name, amount }
  })
  return c.json(expense)
})

expenseRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  await prisma.expense.deleteMany({
    where: { id, userId }
  })
  return c.json({ success: true })
})

expenseRoutes.get('/total', async (c) => {
  const userId = c.get('userId')
  const agg = await prisma.expense.aggregate({
    where: { userId },
    _sum: { amount: true }
  })
  return c.json({ totalExpense: agg._sum.amount ?? 0 })
})

export default expenseRoutes
