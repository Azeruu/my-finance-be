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
    const clerkId = payload.sub as string

    // Sync user to db if missing or link via email if migration
    let user = await prisma.user.findUnique({ where: { clerkId } })
    
    if (!user) {
      // Try to find by email to link old data
      const clerkUser = await clerkClient.users.getUser(clerkId)
      const email = clerkUser.emailAddresses[0]?.emailAddress || ''
      
      user = await prisma.user.findUnique({ where: { email } })
      
      if (user) {
        // Link Clerk ID to existing user
        user = await prisma.user.update({
          where: { email },
          data: { 
            clerkId,
            avatar: clerkUser.imageUrl || user.avatar 
          }
        })
        console.log(`Linked Clerk ID to existing user: ${email}`)
      } else {
        // Create brand new user
        user = await prisma.user.create({
          data: {
            clerkId,
            email,
            name: clerkUser.firstName ? `${clerkUser.firstName} ${clerkUser.lastName || ''}`.trim() : 'User',
            avatar: clerkUser.imageUrl,
          }
        })
        console.log(`Created new user for Clerk ID: ${clerkId}`)
      }
    }

    // Set internal id to context for other routes to use
    c.set('userId', user.id)
    c.set('userEmail', user.email)
    c.set('userName', user.name)

    await next()
  } catch (e: any) {
    console.error('Clerk Auth Error:', e.message)
    return c.json({ error: 'Invalid session' }, 401)
  }
}
