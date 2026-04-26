export function createCurrencyDisplayService(deps: {
  db: any
  discoveryRepo: any
}) {
  return {
    async getDisplayPrice(
      priceMinor: number,
      currency: string,
      preferredCurrency: string = 'TWD',
    ): Promise<{ priceMinor: number; currency: string }> {
      if (currency === preferredCurrency) {
        return { priceMinor, currency }
      }

      const rate = await deps.discoveryRepo.getCurrencyDisplayRate(
        deps.db,
        currency,
        preferredCurrency,
      )

      if (!rate) {
        return { priceMinor, currency }
      }

      const multiplier = Number(rate.rate)
      if (Number.isNaN(multiplier) || multiplier <= 0) {
        return { priceMinor, currency }
      }

      return {
        priceMinor: Math.round(priceMinor * multiplier),
        currency: preferredCurrency,
      }
    },
  }
}
