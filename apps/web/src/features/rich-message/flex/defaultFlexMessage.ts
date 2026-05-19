export const defaultFlexMessage = {
  type: 'flex',
  altText: 'Sample Flex Message',
  contents: {
    type: 'bubble',
    size: 'mega',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: 'Hello World',
          size: 'lg',
          weight: 'bold',
          align: 'center',
        },
        {
          type: 'text',
          text: 'This is a sample Flex Message.',
          size: 'md',
          color: '#666666',
        },
      ],
    },
  },
} as const

export const defaultFlexMessageJson = JSON.stringify(defaultFlexMessage, null, 2)
