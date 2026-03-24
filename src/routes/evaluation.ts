import { Hono } from 'hono'
import { authMiddleware } from '../middlewares/auth.ts'
import { prisma } from '../db.ts'

const evaluationRoutes = new Hono<{ Variables: { userId: string }}>()
evaluationRoutes.use('*', authMiddleware)

evaluationRoutes.get('/', async (c) => {
  const userId = c.get('userId')

  const [incomeAgg, expenseAgg, savingAgg, otherFundAgg] = await Promise.all([
    prisma.income.aggregate({ where: { userId }, _sum: { salary: true, atmBalance: true } }),
    prisma.expense.aggregate({ where: { userId }, _sum: { amount: true } }),
    prisma.saving.aggregate({ where: { userId }, _sum: { amount: true } }),
    prisma.otherFund.aggregate({ where: { userId }, _sum: { amount: true } })
  ])

  return c.json({
    totalSalary: (incomeAgg._sum.salary ?? 0) + (incomeAgg._sum.atmBalance ?? 0),
    totalExpense: expenseAgg._sum.amount ?? 0,
    totalSaving: savingAgg._sum.amount ?? 0,
    totalOtherFund: otherFundAgg._sum.amount ?? 0
  })
})

evaluationRoutes.get('/chart', async (c) => {
  const userId = c.get('userId')
  const { year } = c.req.query()
  if (!year) return c.json({ error: 'Year required' }, 400)

  const parsedYear = parseInt(year)
  const data = []
  
  for (let m = 1; m <= 12; m++) {
    const [income, expenseAgg, savingAgg, otherFundAgg] = await Promise.all([
      prisma.income.findUnique({ where: { userId_month_year: { userId, month: m, year: parsedYear } } }),
      prisma.expense.aggregate({ where: { userId, month: m, year: parsedYear }, _sum: { amount: true } }),
      prisma.saving.aggregate({ where: { userId, month: m, year: parsedYear }, _sum: { amount: true } }),
      prisma.otherFund.aggregate({ where: { userId, month: m, year: parsedYear }, _sum: { amount: true } })
    ])

    data.push({
      month: m,
      pendapatan: (income?.salary ?? 0) + (income?.atmBalance ?? 0),
      pengeluaran: expenseAgg._sum.amount ?? 0,
      tabungan: savingAgg._sum.amount ?? 0,
      danaLainnya: otherFundAgg._sum.amount ?? 0
    })
  }

  return c.json(data)
})

export default evaluationRoutes
