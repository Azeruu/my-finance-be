import { Hono } from 'hono'
import { authMiddleware } from '../middlewares/auth.ts'
import { prisma } from '../db.ts'
import { z } from 'zod'

const savingSchema = z.object({
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2000).max(2100),
  instrument: z.string().min(1).max(100),
  amount: z.coerce.number().min(0),
})

const savingRoutes = new Hono<{ Variables: { userId: string }}>()
savingRoutes.use('*', authMiddleware)

savingRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const { month, year } = c.req.query()
  if (!month || !year) return c.json({ error: 'Month and year required' }, 400)

  const savings = await prisma.saving.findMany({
    where: { userId, month: parseInt(month), year: parseInt(year) },
    orderBy: { createdAt: 'desc' }
  })
  return c.json(savings)
})

savingRoutes.post('/', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json()

  const result = savingSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.format() }, 400)
  }

  const { month, year, instrument, amount } = result.data

  const saving = await prisma.saving.create({
    data: { userId, month, year, instrument, amount }
  })
  return c.json(saving)
})

savingRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  await prisma.saving.deleteMany({
    where: { id, userId }
  })
  return c.json({ success: true })
})

savingRoutes.get('/total', async (c) => {
  const userId = c.get('userId')
  const agg = await prisma.saving.aggregate({
    where: { userId },
    _sum: { amount: true }
  })
  return c.json({ totalSaving: agg._sum.amount ?? 0 })
})

export default savingRoutes
