import 'dotenv/config'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { secureHeaders } from 'hono/secure-headers'

// Routes
import authRoutes from './routes/auth.ts'
import incomeRoutes from './routes/income.ts'
import expenseRoutes from './routes/expense.ts'
import savingRoutes from './routes/saving.ts'
import otherFundRoutes from './routes/otherFund.ts'
import recentExpenseRoutes from './routes/recentExpense.ts'
import evaluationRoutes from './routes/evaluation.ts'

const app = new Hono()

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173'

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use('*', secureHeaders())

app.use(
  '/*',
  cors({
    origin: (origin) => {
      const allowedOrigins = [
        FRONTEND_URL,
        'http://localhost:5173',
      ]
      if (!origin) return FRONTEND_URL
      if (allowedOrigins.includes(origin) || (origin.includes('localhost') && process.env.NODE_ENV !== 'production')) {
         return origin
      }
      return FRONTEND_URL
    },
    allowHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  })
)

// Global Error Handler
app.onError((err, c) => {
  console.error(`[Global Error]: ${err.message}`, err.stack)
  
  const status = (err as any).status || 500
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal Server Error' 
    : err.message

  return c.json({ error: message }, status)
})

// ─── Rate Limiting ─────────────────────────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; lastReset: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 menit
const MAX_REQUESTS = 100 // 100 request per menit per IP

app.use('*', async (c, next) => {
  const ip = c.req.header('x-forwarded-for') || 'anonymous'
  const now = Date.now()
  const record = rateLimitMap.get(ip) || { count: 0, lastReset: now }

  if (now - record.lastReset > RATE_LIMIT_WINDOW) {
    record.count = 1
    record.lastReset = now
  } else {
    record.count++
  }

  rateLimitMap.set(ip, record)

  if (record.count > MAX_REQUESTS) {
    return c.json({ error: 'Too many requests, please try again later.' }, 429)
  }

  await next()
})

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get('/', (c) => c.text('Finance API is running!'))
app.get('/api/ping', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

app.route('/api/auth', authRoutes)
app.route('/api/income', incomeRoutes)
app.route('/api/expense', expenseRoutes)
app.route('/api/saving', savingRoutes)
app.route('/api/other-fund', otherFundRoutes)
app.route('/api/recent-expense', recentExpenseRoutes)
app.route('/api/evaluation', evaluationRoutes)

const port = parseInt(process.env.PORT || '3000')
console.log(`Server is running on port ${port}`)

serve({
  fetch: app.fetch,
  port
})

export default app