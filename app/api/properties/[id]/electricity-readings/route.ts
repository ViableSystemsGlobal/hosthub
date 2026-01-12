import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth-helpers'
import { sendNotification } from '@/lib/notifications/service'
import { NotificationChannel, NotificationType } from '@prisma/client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Verify property access
    const property = await prisma.property.findUnique({
      where: { id },
      select: {
        ownerId: true,
        managerId: true,
      },
    })

    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }

    // Check permissions
    const canAccess =
      ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS'].includes(user.role) ||
      (user.role === 'MANAGER' && property.managerId === user.id) ||
      (user.role === 'OWNER' && property.ownerId === user.ownerId)

    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const readings = await prisma.electricityMeterReading.findMany({
      where: { propertyId: id },
      include: {
        EnteredBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { readingDate: 'desc' },
      take: 100,
    })

    return NextResponse.json(readings)
  } catch (error: any) {
    console.error('Failed to fetch electricity readings:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch electricity readings' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only operations, managers, and admins can add readings
    if (!['OPERATIONS', 'MANAGER', 'GENERAL_MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { balance, readingDate, notes } = body

    if (balance === undefined || balance === null) {
      return NextResponse.json(
        { error: 'Balance is required' },
        { status: 400 }
      )
    }

    if (balance < 0) {
      return NextResponse.json(
        { error: 'Balance cannot be negative' },
        { status: 400 }
      )
    }

    // Verify property access
    const property = await prisma.property.findUnique({
      where: { id },
      include: {
        Owner: true,
        User: true, // manager
      },
    })

    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }

    // Verify manager can access this property
    if (user.role === 'MANAGER' && property.managerId !== user.id) {
      return NextResponse.json(
        { error: 'You can only add readings for properties you manage' },
        { status: 403 }
      )
    }

    // Create reading
    const reading = await prisma.electricityMeterReading.create({
      data: {
        id: crypto.randomUUID(),
        propertyId: id,
        balance: parseFloat(balance),
        readingDate: readingDate ? new Date(readingDate) : new Date(),
        enteredById: user.id,
        notes: notes || null,
        updatedAt: new Date(),
      },
      include: {
        EnteredBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    // Check if balance is below threshold
    if (property.electricityMeterMinimumBalance !== null) {
      const threshold = property.electricityMeterMinimumBalance
      if (balance < threshold) {
        // Check if there's already an active alert
        const existingAlert = await prisma.electricityAlert.findFirst({
          where: {
            propertyId: id,
            resolvedAt: null,
          },
        })

        if (!existingAlert) {
          // Create alert
          const alert = await prisma.electricityAlert.create({
            data: {
              id: crypto.randomUUID(),
              propertyId: id,
              readingId: reading.id,
              thresholdAmount: threshold,
              currentBalance: balance,
              alertSentAt: new Date(),
              alertSentTo: [],
            },
          })

          // Get users to notify
          const usersToNotify: string[] = []
          
          // Add property manager
          if (property.managerId) {
            usersToNotify.push(property.managerId)
          }

          // Add admin users
          const adminUsers = await prisma.user.findMany({
            where: {
              role: { in: ['SUPER_ADMIN', 'ADMIN'] },
            },
            select: { id: true },
          })
          adminUsers.forEach(u => usersToNotify.push(u.id))

          // Update alert with notified users
          await prisma.electricityAlert.update({
            where: { id: alert.id },
            data: {
              alertSentTo: usersToNotify,
            },
          })

          // Send notifications (non-blocking)
          try {
            const notificationMessage = `⚠️ Low Electricity Balance Alert\n\nProperty: ${property.name}\nCurrent Balance: ${property.electricityMeterUnit || 'GHS'} ${balance.toFixed(2)}\nThreshold: ${property.electricityMeterUnit || 'GHS'} ${threshold.toFixed(2)}\n\nPlease top up the meter soon.`

            // Notify property owner
            await sendNotification({
              ownerId: property.ownerId,
              type: NotificationType.ELECTRICITY_LOW_BALANCE,
              channels: [NotificationChannel.WHATSAPP, NotificationChannel.SMS, NotificationChannel.EMAIL],
              title: 'Low Electricity Balance Alert',
              message: notificationMessage,
              metadata: {
                propertyId: id,
                propertyName: property.name,
                currentBalance: balance,
                threshold: threshold,
                readingId: reading.id,
              },
            }).catch((err) => {
              console.error('Failed to send notification to owner:', err)
            })

            // Notify manager if exists
            if (property.managerId) {
              const manager = await prisma.user.findUnique({
                where: { id: property.managerId },
                include: { Owner: true },
              })
              if (manager?.Owner) {
                await sendNotification({
                  ownerId: manager.Owner.id,
                  type: NotificationType.ELECTRICITY_LOW_BALANCE,
                  channels: [NotificationChannel.WHATSAPP, NotificationChannel.SMS, NotificationChannel.EMAIL],
                  title: 'Low Electricity Balance Alert',
                  message: notificationMessage,
                  metadata: {
                    propertyId: id,
                    propertyName: property.name,
                    currentBalance: balance,
                    threshold: threshold,
                    readingId: reading.id,
                  },
                }).catch((err) => {
                  console.error('Failed to send notification to manager:', err)
                })
              }
            }
          } catch (error) {
            console.error('Notification error:', error)
          }
        }
      } else {
        // Balance is above threshold, resolve any active alerts
        await prisma.electricityAlert.updateMany({
          where: {
            propertyId: id,
            resolvedAt: null,
          },
          data: {
            resolvedAt: new Date(),
          },
        })
      }
    }

    return NextResponse.json(reading, { status: 201 })
  } catch (error: any) {
    console.error('Failed to create electricity reading:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create electricity reading' },
      { status: 500 }
    )
  }
}

