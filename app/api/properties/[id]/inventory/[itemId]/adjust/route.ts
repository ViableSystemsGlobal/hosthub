import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth-helpers'
import { sendNotification } from '@/lib/notifications/service'
import { UserRole, NotificationChannel, NotificationType } from '@prisma/client'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const user = await requireRole(
      [UserRole.MANAGER, UserRole.OPERATIONS, UserRole.ADMIN, UserRole.SUPER_ADMIN],
      request
    )

    const { id, itemId } = await params
    const body = await request.json()
    const { quantity, notes } = body

    if (quantity === undefined || quantity === null) {
      return NextResponse.json(
        { error: 'Quantity is required' },
        { status: 400 }
      )
    }

    const inventoryItem = await prisma.inventoryItem.findUnique({
      where: { id: itemId },
      include: {
        Property: {
          include: {
            Owner: {
              include: {
                User: true,
              },
            },
            User: true, // manager
          },
        },
      },
    })

    if (!inventoryItem) {
      return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 })
    }

    if (inventoryItem.propertyId !== id) {
      return NextResponse.json(
        { error: 'Inventory item does not belong to this property' },
        { status: 400 }
      )
    }

    if (inventoryItem.type !== 'CONSUMABLE') {
      return NextResponse.json(
        { error: 'Can only adjust quantity for consumable items' },
        { status: 400 }
      )
    }

    // Verify manager can access this property
    if (user.role === 'MANAGER' && inventoryItem.Property.managerId !== user.id) {
      return NextResponse.json(
        { error: 'You can only adjust inventory for properties you manage' },
        { status: 403 }
      )
    }

    const previousQuantity = inventoryItem.quantity
    const newQuantity = parseFloat(quantity)
    const wasLowStock = previousQuantity !== null && 
                       inventoryItem.minimumQuantity !== null && 
                       previousQuantity <= inventoryItem.minimumQuantity
    const isLowStock = inventoryItem.minimumQuantity !== null && 
                       newQuantity <= inventoryItem.minimumQuantity

    // Determine change type
    let changeType = 'adjustment'
    if (newQuantity > (previousQuantity || 0)) {
      changeType = 'restocked'
    } else if (newQuantity < (previousQuantity || 0)) {
      changeType = 'consumed'
    }

    // Update inventory item
    const updated = await prisma.inventoryItem.update({
      where: { id: itemId },
      data: {
        quantity: newQuantity,
        lastCheckedAt: new Date(),
        lastCheckedById: user.id,
        notes: notes || inventoryItem.notes || null,
        updatedAt: new Date(),
      },
      include: {
        LastCheckedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    // Create history entry
    await prisma.inventoryHistory.create({
      data: {
        id: crypto.randomUUID(),
        inventoryItemId: itemId,
        previousQuantity: previousQuantity,
        newQuantity: newQuantity,
        changeType: changeType,
        notes: notes || null,
        changedById: user.id,
        createdAt: new Date(),
      },
    })

    // Send low stock alert if quantity just fell below minimum (and wasn't already low)
    if (isLowStock && !wasLowStock && inventoryItem.minimumQuantity !== null) {
      try {
        const property = inventoryItem.Property
        const propertyName = property.nickname || property.name
        const unit = inventoryItem.unit || 'pieces'
        
        const notificationMessage = `⚠️ Low Stock Alert\n\nProperty: ${propertyName}\nItem: ${inventoryItem.name}\nCurrent Quantity: ${newQuantity} ${unit}\nMinimum Threshold: ${inventoryItem.minimumQuantity} ${unit}\n\nPlease restock this item soon.`

        // Notify property owner
        if (property.Owner) {
          await sendNotification({
            ownerId: property.Owner.id,
            type: NotificationType.INVENTORY_LOW_STOCK,
            channels: [NotificationChannel.SMS, NotificationChannel.EMAIL],
            title: 'Low Stock Alert',
            message: notificationMessage,
            actionUrl: `/admin/properties/${property.id}`,
            actionText: 'View Property',
            metadata: {
              propertyId: property.id,
              inventoryItemId: itemId,
              itemName: inventoryItem.name,
              currentQuantity: newQuantity,
              minimumQuantity: inventoryItem.minimumQuantity,
            },
          })
        }

        // Notify property manager
        if (property.User && property.User.email) {
          // For managers, we need to send via email/SMS directly since they're not owners
          const { sendEmail } = await import('@/lib/notifications/email')
          const { sendSMS } = await import('@/lib/notifications/sms')
          
          if (property.User.email) {
            await sendEmail({
              to: property.User.email,
              subject: `Low Stock Alert: ${inventoryItem.name} - ${propertyName}`,
              html: `
                <h2>Low Stock Alert</h2>
                <p><strong>Property:</strong> ${propertyName}</p>
                <p><strong>Item:</strong> ${inventoryItem.name}</p>
                <p><strong>Current Quantity:</strong> ${newQuantity} ${unit}</p>
                <p><strong>Minimum Threshold:</strong> ${inventoryItem.minimumQuantity} ${unit}</p>
                <p>Please restock this item soon.</p>
                <p><a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/properties/${property.id}">View Property</a></p>
              `,
            })
          }

          if (property.User.phoneNumber) {
            await sendSMS(property.User.phoneNumber, notificationMessage)
          }
        }

        // Notify admin users
        const adminUsers = await prisma.user.findMany({
          where: {
            role: { in: ['SUPER_ADMIN', 'ADMIN'] },
          },
          select: { 
            id: true,
            email: true,
            phoneNumber: true,
          },
        })

        for (const admin of adminUsers) {
          if (admin.email) {
            const { sendEmail } = await import('@/lib/notifications/email')
            await sendEmail({
              to: admin.email,
              subject: `Low Stock Alert: ${inventoryItem.name} - ${propertyName}`,
              html: `
                <h2>Low Stock Alert</h2>
                <p><strong>Property:</strong> ${propertyName}</p>
                <p><strong>Item:</strong> ${inventoryItem.name}</p>
                <p><strong>Current Quantity:</strong> ${newQuantity} ${unit}</p>
                <p><strong>Minimum Threshold:</strong> ${inventoryItem.minimumQuantity} ${unit}</p>
                <p>Please restock this item soon.</p>
                <p><a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/properties/${property.id}">View Property</a></p>
              `,
            })
          }

          if (admin.phoneNumber) {
            const { sendSMS } = await import('@/lib/notifications/sms')
            await sendSMS(admin.phoneNumber, notificationMessage)
          }
        }
      } catch (notificationError) {
        // Log but don't fail the request if notifications fail
        console.error('Failed to send low stock notifications:', notificationError)
      }
    }

    return NextResponse.json(updated)
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Failed to adjust inventory:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to adjust inventory' },
      { status: 500 }
    )
  }
}

