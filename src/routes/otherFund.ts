import { Hono } from 'hono'
import { authMiddleware } from '../middlewares/auth.ts'
import { prisma } from '../db.ts'
import { z } from 'zod'

const otherFundSchema = z.object({
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2000).max(2100),
  name: z.string().min(1).max(100),
  amount: z.coerce.number().min(0),
})

const otherFundRoutes = new Hono<{ Variables: { userId: string }}>()
otherFundRoutes.use('*', authMiddleware)

otherFundRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const { month, year } = c.req.query()
  if (!month || !year) return c.json({ error: 'Month and year required' }, 400)

  const funds = await prisma.otherFund.findMany({
    where: { userId, month: parseInt(month), year: parseInt(year) },
    orderBy: { createdAt: 'desc' }
  })
  return c.json(funds)
})

otherFundRoutes.post('/', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json()

  const result = otherFundSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.format() }, 400)
  }

  const { month, year, name, amount } = result.data

  const fund = await prisma.otherFund.create({
    data: { userId, month, year, name, amount }
  })
  return c.json(fund)
})

otherFundRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  await prisma.otherFund.deleteMany({
    where: { id, userId }
  })
  return c.json({ success: true })
})

otherFundRoutes.get('/total', async (c) => {
  const userId = c.get('userId')
  const agg = await prisma.otherFund.aggregate({
    where: { userId },
    _sum: { amount: true }
  })
  return c.json({ totalOtherFund: agg._sum.amount ?? 0 })
})

export default otherFundRoutes
