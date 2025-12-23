import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

// Use Node.js global to persist across hot reloads
declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined
  // eslint-disable-next-line no-var
  var __pgPool__: Pool | undefined
}

function getPool(): Pool {
  if (!global.__pgPool__) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set')
    }
    
    global.__pgPool__ = new Pool({ 
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
  }
  return global.__pgPool__
}

function createPrismaClient(): PrismaClient {
  if (!global.__prisma__) {
    const pool = getPool()
    const adapter = new PrismaPg(pool)
    global.__prisma__ = new PrismaClient({ adapter })
  }
  return global.__prisma__
}

export const prisma = createPrismaClient()
