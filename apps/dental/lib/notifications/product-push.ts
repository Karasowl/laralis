import { NextRequest } from 'next/server'
import { getPushNotificationServiceForRequest } from '@/lib/notifications/qa'

export type StockedSupplyForPush = {
  id: string
  name: string
  stock_quantity?: number | null
  min_stock_alert?: number | null
}

export function isLowStockSupply(supply: StockedSupplyForPush): boolean {
  const stockQuantity = Number(supply.stock_quantity ?? 0)
  const minStockAlert = Number(supply.min_stock_alert ?? 0)

  return Number.isFinite(stockQuantity) && Number.isFinite(minStockAlert) && stockQuantity <= minStockAlert
}

export async function sendLowStockAlertPush(
  request: NextRequest,
  clinicId: string,
  supply: StockedSupplyForPush
) {
  if (!isLowStockSupply(supply)) {
    return null
  }

  return getPushNotificationServiceForRequest(request).sendNotificationToClinic({
    clinicId,
    notificationType: 'low_stock_alert',
    payload: {
      title: 'Inventario bajo',
      body: `${supply.name} tiene ${Number(supply.stock_quantity ?? 0)} unidades restantes`,
      icon: '/icons/icon-192x192.png',
      url: '/supplies',
      tag: `low-stock-${supply.id}`,
      requireInteraction: true,
    },
  })
}
