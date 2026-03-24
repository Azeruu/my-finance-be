import { verifyToken, createClerkClient } from '@clerk/backend'
import { prisma } from '../db.ts'

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY!
export const clerkClient = createClerkClient({ secretKey: CLERK_SECRET_KEY })

export const authMiddleware = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const token = authHeader.substring(7)

  try {
    const payload = await verifyToken(token, { secretKey: CLERK_SECRET_KEY })
    const userId = payload.sub as string
    c.set('userId', userId)

    // Sync user to db if missing
    let user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      const clerkUser = await clerkClient.users.getUser(userId)
      user = await prisma.user.create({
        data: {
          id: userId,
          email: clerkUser.emailAddresses[0]?.emailAddress || '',
          name: clerkUser.firstName ? `${clerkUser.firstName} ${clerkUser.lastName || ''}`.trim() : 'User',
          avatar: clerkUser.imageUrl,
        }
      })
    }

    c.set('userEmail', user.email)
    c.set('userName', user.name)

    await next()
  } catch (e: any) {
    console.error('Clerk Auth Error:', e.message)
    return c.json({ error: 'Invalid session' }, 401)
  }
}
