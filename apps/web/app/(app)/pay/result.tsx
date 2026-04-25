import { PaymentResultPage } from '~/features/sticker-market/PaymentResultPage'

export default function Page() {
  const orderId =
    typeof window !== 'undefined'
      ? (new URLSearchParams(window.location.search).get('orderId') ?? '')
      : ''

  return <PaymentResultPage orderId={orderId} />
}
