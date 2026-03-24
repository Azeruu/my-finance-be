import { Hono } from 'hono'
import { authMiddleware } from '../middlewares/auth.ts'
import { prisma } from '../db.ts'
import { z } from 'zod'

const incomeSchema = z.object({
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2000).max(2100),
  salary: z.coerce.number().min(0),
  atmBalance: z.coerce.number().min(0),
})

const incomeRoutes = new Hono<{ Variables: { userId: string }}>()
incomeRoutes.use('*', authMiddleware)

incomeRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const { month, year } = c.req.query()
  if (!month || !year) return c.json({ error: 'Month and year required' }, 400)

  const income = await prisma.income.findUnique({
    where: {
      userId_month_year: {
        userId,
        month: parseInt(month),
        year: parseInt(year)
      }
    }
  })
  return c.json(income || { salary: 0, atmBalance: 0 })
})

incomeRoutes.post('/', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json()
  
  const result = incomeSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: 'Invalid input', details: result.error.format() }, 400)
  }

  const { month, year, salary, atmBalance } = result.data

  const income = await prisma.income.upsert({
    where: {
      userId_month_year: {
        userId,
        month,
        year
      }
    },
    update: { salary, atmBalance },
    create: { userId, month, year, salary, atmBalance }
  })
  return c.json(income)
})

incomeRoutes.get('/total', async (c) => {
  const userId = c.get('userId')
  const agg = await prisma.income.aggregate({
    where: { userId },
    _sum: { salary: true }
  })
  return c.json({ totalSalary: agg._sum.salary ?? 0 })
})

export default incomeRoutes
