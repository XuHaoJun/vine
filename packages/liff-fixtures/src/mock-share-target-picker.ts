import liff from '@vine/liff'

const VALID_SEND_MESSAGES = [
  { type: 'text', text: 'Hello from LIFF!' },
  {
    type: 'image',
    originalContentUrl: 'https://example.com/img.jpg',
    previewImageUrl: 'https://example.com/img.jpg',
  },
  {
    type: 'video',
    originalContentUrl: 'https://example.com/video.mp4',
    previewImageUrl: 'https://example.com/video.jpg',
  },
  {
    type: 'audio',
    originalContentUrl: 'https://example.com/audio.mp3',
    duration: 5000,
  },
  {
    type: 'location',
    title: 'Station',
    address: '1 Main St',
    latitude: 35.6812,
    longitude: 139.7671,
  },
]

const VALID_SHARE_MESSAGES = [
  { type: 'text', text: 'Share from LIFF!' },
  {
    type: 'image',
    originalContentUrl: 'https://example.com/share.jpg',
    previewImageUrl: 'https://example.com/share.jpg',
  },
  {
    type: 'video',
    originalContentUrl: 'https://example.com/share-video.mp4',
    previewImageUrl: 'https://example.com/share-video.jpg',
  },
  {
    type: 'audio',
    originalContentUrl: 'https://example.com/share-audio.mp3',
    duration: 3000,
  },
  {
    type: 'location',
    title: 'Park',
    address: '2 Park Ave',
    latitude: 40.7128,
    longitude: -74.006,
  },
]

const INVALID_TOO_MANY = Array.from({ length: 6 }, (_, i) => ({
  type: 'text',
  text: `msg-${i}`,
}))

const INVALID_TEMPLATE = [
  {
    type: 'template',
    altText: 'Template',
    template: { type: 'buttons', actions: [] },
  },
]

const INVALID_IMAGEMAP = [
  {
    type: 'imagemap',
    baseUrl: 'https://example.com',
    baseSize: { width: 1040, height: 1040 },
    altText: 'im',
    actions: [],
  },
]

const INVALID_FLEX_NON_URI = [
  {
    type: 'flex',
    altText: 'Flex',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: { type: 'postback', label: 'Tap', data: 'id=1' },
          },
        ],
      },
    },
  },
]

function createButton(testId: string, label: string): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.setAttribute('data-testid', testId)
  btn.type = 'button'
  btn.textContent = label
  btn.disabled = true
  return btn
}

function createResult(testId: string): HTMLPreElement {
  const el = document.createElement('pre')
  el.setAttribute('data-testid', testId)
  el.style.display = 'none'
  return el
}

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

  const initBtn = createButton('mock-liff-init-btn', 'Init LIFF')
  initBtn.disabled = false
  root.appendChild(initBtn)

  const getContextBtn = createButton('mock-liff-get-context-btn', 'getContext()')
  root.appendChild(getContextBtn)
  const contextResult = createResult('mock-liff-context-result')
  root.appendChild(contextResult)

  const getProfileBtn = createButton('mock-liff-get-profile-btn', 'getProfile()')
  root.appendChild(getProfileBtn)
  const profileResult = createResult('mock-liff-profile-result')
  root.appendChild(profileResult)

  const sendValidBtn = createButton('mock-liff-send-valid-btn', 'sendMessages (valid)')
  root.appendChild(sendValidBtn)
  const sendValidResult = createResult('mock-liff-send-valid-result')
  root.appendChild(sendValidResult)

  const sendInvalidBtn = createButton(
    'mock-liff-send-invalid-btn',
    'sendMessages (invalid)',
  )
  root.appendChild(sendInvalidBtn)
  const sendInvalidResult = createResult('mock-liff-send-invalid-result')
  root.appendChild(sendInvalidResult)

  const shareValidBtn = createButton(
    'mock-liff-share-valid-btn',
    'shareTargetPicker (valid)',
  )
  root.appendChild(shareValidBtn)
  const shareValidResult = createResult('mock-liff-share-valid-result')
  root.appendChild(shareValidResult)

  const shareInvalidBtn = createButton(
    'mock-liff-share-invalid-btn',
    'shareTargetPicker (invalid)',
  )
  root.appendChild(shareInvalidBtn)
  const shareInvalidResult = createResult('mock-liff-share-invalid-result')
  root.appendChild(shareInvalidResult)

  const closeBtn = createButton('mock-liff-close-btn', 'closeWindow()')
  root.appendChild(closeBtn)

  function enableButtons() {
    getContextBtn.disabled = false
    getProfileBtn.disabled = false
    sendValidBtn.disabled = false
    sendInvalidBtn.disabled = false
    shareValidBtn.disabled = false
    shareInvalidBtn.disabled = false
    closeBtn.disabled = false
  }

  initBtn.addEventListener('click', async () => {
    try {
      await liff.init({ liffId })
      status.textContent = `Initialized. Token: ${liff.getAccessToken() ? 'present' : 'none'}`
      enableButtons()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      status.textContent = `Init failed: ${msg}`
    }
  })

  getContextBtn.addEventListener('click', () => {
    try {
      const ctx = liff.getContext()
      contextResult.textContent = JSON.stringify(ctx)
      contextResult.style.display = 'block'
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      contextResult.textContent = `Error: ${msg}`
      contextResult.style.display = 'block'
    }
  })

  getProfileBtn.addEventListener('click', async () => {
    try {
      const profile = await liff.getProfile()
      profileResult.textContent = JSON.stringify(profile)
      profileResult.style.display = 'block'
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      profileResult.textContent = `Error: ${msg}`
      profileResult.style.display = 'block'
    }
  })

  sendValidBtn.addEventListener('click', async () => {
    try {
      await liff.sendMessages(VALID_SEND_MESSAGES as any)
      sendValidResult.textContent = 'sent'
      sendValidResult.style.display = 'block'
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      sendValidResult.textContent = `Error: ${msg}`
      sendValidResult.style.display = 'block'
    }
  })

  sendInvalidBtn.addEventListener('click', async () => {
    try {
      await liff.sendMessages(INVALID_TOO_MANY as any)
      sendInvalidResult.textContent = 'sent (unexpected)'
      sendInvalidResult.style.display = 'block'
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      sendInvalidResult.textContent = `Error: ${msg}`
      sendInvalidResult.style.display = 'block'
    }
  })

  shareValidBtn.addEventListener('click', async () => {
    try {
      const result = await liff.shareTargetPicker(VALID_SHARE_MESSAGES as any, {
        isMultiple: true,
      })
      shareValidResult.textContent = JSON.stringify(result)
      shareValidResult.style.display = 'block'
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      shareValidResult.textContent = `Error: ${msg}`
      shareValidResult.style.display = 'block'
    }
  })

  shareInvalidBtn.addEventListener('click', async () => {
    try {
      const result = await liff.shareTargetPicker(INVALID_TEMPLATE as any, {
        isMultiple: true,
      })
      shareInvalidResult.textContent = JSON.stringify(result)
      shareInvalidResult.style.display = 'block'
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      shareInvalidResult.textContent = `Error: ${msg}`
      shareInvalidResult.style.display = 'block'
    }
  })

  closeBtn.addEventListener('click', () => {
    liff.closeWindow()
  })

  // Expose helpers for direct test evaluation
  ;(window as any).__liffFixture = {
    liff,
    VALID_SEND_MESSAGES,
    VALID_SHARE_MESSAGES,
    INVALID_TOO_MANY,
    INVALID_TEMPLATE,
    INVALID_IMAGEMAP,
    INVALID_FLEX_NON_URI,
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => main())
} else {
  main()
}
