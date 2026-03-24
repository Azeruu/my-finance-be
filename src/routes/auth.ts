import { Hono } from 'hono'
import { authMiddleware } from '../middlewares/auth.ts'
import { prisma } from '../db.ts'


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



export default authRoutes
