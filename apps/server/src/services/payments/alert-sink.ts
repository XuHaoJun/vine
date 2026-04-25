export type PaymentAlertSeverity = 'warning' | 'critical'

export type PaymentAlert = {
  type:
    | 'payment.amount_mismatch'
    | 'payment.entitlement_grant_failed'
    | 'payment.refund_failed'
    | 'payment.reconciliation_mismatch'
    | 'payment.webhook_verification_failed'
  severity: PaymentAlertSeverity
  orderId: string | undefined
  message: string
  context: Record<string, unknown>
}

export type PaymentAlertSink = {
  notify(alert: PaymentAlert): Promise<void>
}

type MinLogger = {
  warn(obj: object, msg: string): void
  error(obj: object, msg: string): void
}

export function createLogPaymentAlertSink(log: MinLogger): PaymentAlertSink {
  return {
    async notify(alert) {
      const payload = {
        type: alert.type,
        orderId: alert.orderId,
        context: alert.context,
      }
      if (alert.severity === 'critical') {
        log.error(payload, alert.message)
        return
      }
      log.warn(payload, alert.message)
    },
  }
}
