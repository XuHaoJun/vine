import type { ChargeStatusResult, GetChargeInput } from '@vine/pay'
import type { StickerOrderRepository } from './order.repository'
import type { EntitlementRepository } from './entitlement.repository'
import type { PaymentAlertSink } from './alert-sink'

export type ReconciliationServiceDeps = {
  db: { transaction: (fn: (tx: any) => Promise<any>) => Promise<any> }
  pay: {
    getCharge: (input: GetChargeInput) => Promise<ChargeStatusResult>
  }
  orderRepo: Pick<
    StickerOrderRepository,
    'findForReconciliation' | 'updateReconciliation' | 'transitionToPaid'
  >
  entitlementRepo: Pick<EntitlementRepository, 'grant'>
  alerts: PaymentAlertSink
}

export type ReconcileOrdersInput = {
  since: Date
  limit: number
  dryRun: boolean
}

export type ReconciliationMismatch = {
  orderId: string
  localStatus: string
  connectorStatus: string
  action: string
}

export type ReconcileOrdersResult = {
  checked: number
  mismatches: ReconciliationMismatch[]
}

export function createReconciliationService(deps: ReconciliationServiceDeps) {
  return {
    async reconcileOrders(input: ReconcileOrdersInput): Promise<ReconcileOrdersResult> {
      const orders = await deps.orderRepo.findForReconciliation(deps.db, {
        since: input.since,
        limit: input.limit,
      })

      const mismatches: ReconciliationMismatch[] = []

      for (const order of orders) {
        let chargeStatus: ChargeStatusResult | undefined
        try {
          chargeStatus = await deps.pay.getCharge({ merchantTransactionId: order.id })
        } catch {
          // Continue batch after per-order query errors
          mismatches.push({
            orderId: order.id,
            localStatus: order.status,
            connectorStatus: 'query_error',
            action: 'reported',
          })
          await deps.orderRepo.updateReconciliation(deps.db, order.id, {
            connectorStatus: 'query_error',
            mismatch: 'query_error',
          })
          continue
        }

        const connectorStatus = chargeStatus.status
        const localStatus = order.status

        let mismatch: string | undefined
        let action: string | undefined

        const isPaidMismatch =
          (localStatus === 'created' || localStatus === 'failed') &&
          connectorStatus === 'paid'

        const isDangerousMismatch =
          localStatus === 'paid' &&
          (connectorStatus === 'unpaid' || connectorStatus === 'not_found')

        if (isPaidMismatch) {
          mismatch = `local=${localStatus}, connector=${connectorStatus}`
          if (input.dryRun) {
            action = 'reported'
          } else {
            action = 'fixed'
            await deps.db.transaction(async (tx) => {
              const transitionResult = await deps.orderRepo.transitionToPaid(tx, order.id, {
                connectorChargeId: chargeStatus.connectorChargeId,
                paidAt: chargeStatus.paidAt ? chargeStatus.paidAt : new Date(),
              })
              if (transitionResult === 0) {
                action = 'reported'
                return
              }
              await deps.entitlementRepo.grant(tx, {
                userId: order.userId,
                packageId: order.packageId,
                grantedByOrderId: order.id,
              })
            })
          }
        } else if (isDangerousMismatch) {
          mismatch = `local=${localStatus}, connector=${connectorStatus}`
          if (input.dryRun) {
            action = 'reported'
          } else {
            action = 'alerted'
            await deps.alerts.notify({
              type: 'payment.reconciliation_mismatch',
              severity: 'critical',
              orderId: order.id,
              message: `Reconciliation mismatch for order ${order.id}: local=${localStatus}, connector=${connectorStatus}`,
              context: { localStatus, connectorStatus, raw: chargeStatus.raw },
            })
          }
        }

        await deps.orderRepo.updateReconciliation(deps.db, order.id, {
          connectorStatus,
          mismatch,
        })

        if (mismatch && action) {
          mismatches.push({
            orderId: order.id,
            localStatus,
            connectorStatus,
            action,
          })
        }
      }

      return { checked: orders.length, mismatches }
    },
  }
}
