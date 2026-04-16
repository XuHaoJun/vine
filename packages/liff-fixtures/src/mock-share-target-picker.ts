import liff from '@vine/liff'

function main(): void {
  const params = new URLSearchParams(window.location.search)
  const liffId = params.get('liffId') ?? ''

  const root = document.body
  root.style.margin = '16px'
  root.style.fontFamily = 'system-ui, sans-serif'

  const title = document.createElement('h1')
  title.textContent = 'Mock LIFF App'
  root.appendChild(title)

  const status = document.createElement('p')
  status.setAttribute('data-testid', 'mock-liff-status')
  status.textContent = 'Initializing...'
  root.appendChild(status)

  const shareResult = document.createElement('p')
  shareResult.setAttribute('data-testid', 'mock-liff-share-result')
  shareResult.style.display = 'none'
  root.appendChild(shareResult)

  const initBtn = document.createElement('button')
  initBtn.setAttribute('data-testid', 'mock-liff-init-btn')
  initBtn.type = 'button'
  initBtn.textContent = 'Init LIFF'
  root.appendChild(initBtn)

  const shareBtn = document.createElement('button')
  shareBtn.setAttribute('data-testid', 'mock-liff-share-btn')
  shareBtn.type = 'button'
  shareBtn.textContent = 'Share Test Message'
  shareBtn.disabled = true
  root.appendChild(shareBtn)

  initBtn.addEventListener('click', async () => {
    try {
      await liff.init({ liffId })
      status.textContent = `Initialized. Token: ${liff.getAccessToken() ? 'present' : 'none'}`
      shareBtn.disabled = false
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      status.textContent = `Init failed: ${msg}`
    }
  })

  shareBtn.addEventListener('click', async () => {
    status.textContent = 'Calling shareTargetPicker...'
    shareResult.style.display = 'none'
    try {
      const result = await liff.shareTargetPicker(
        [{ type: 'text', text: 'Hello from LIFF!' }],
        { isMultiple: true },
      )
      if (
        result &&
        typeof result === 'object' &&
        'status' in result &&
        result.status === 'sent'
      ) {
        status.textContent = 'Share succeeded!'
        shareResult.textContent = 'Result: sent'
        shareResult.style.display = 'block'
      } else {
        status.textContent = 'Share cancelled or failed.'
        shareResult.textContent = 'Result: cancelled'
        shareResult.style.display = 'block'
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      status.textContent = `Share error: ${msg}`
      shareResult.textContent = 'Result: error'
      shareResult.style.display = 'block'
    }
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => main())
} else {
  main()
}
