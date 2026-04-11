import { useEffect } from 'react'
import { useTanQuery } from '~/query'
import { oaClient } from '~/features/oa/client'

type RichMenuArea = {
  bounds: { x: number; y: number; width: number; height: number }
  action: {
    type: string
    label?: string
    uri?: string
    data?: string
    text?: string
    richMenuAliasId?: string
    inputOption?: string
    displayText?: string
  }
}

type RichMenuData = {
  richMenuId: string
  name: string
  chatBarText: string
  selected: boolean
  sizeWidth: number
  sizeHeight: number
  areas: RichMenuArea[]
}

type UseRichMenuResult = {
  richMenu: RichMenuData | null
  imageUrl: string | null
  isLoading: boolean
}

export function useRichMenu(oaId: string | undefined): UseRichMenuResult {
  const { data, isLoading } = useTanQuery({
    queryKey: ['oa', 'richMenu', 'active', oaId],
    queryFn: async () => {
      if (!oaId) return null
      const res = await oaClient.getActiveRichMenu({
        officialAccountId: oaId,
      })
      if (!res.richMenu) return null

      let imageUrl: string | null = null
      if (res.image && res.image.length > 0) {
        const blob = new Blob([res.image as BlobPart], {
          type: res.imageContentType ?? 'image/jpeg',
        })
        imageUrl = URL.createObjectURL(blob)
      }

      return {
        richMenu: {
          richMenuId: res.richMenu.richMenuId,
          name: res.richMenu.name,
          chatBarText: res.richMenu.chatBarText,
          selected: res.richMenu.selected,
          sizeWidth: res.richMenu.sizeWidth,
          sizeHeight: res.richMenu.sizeHeight,
          areas: res.richMenu.areas.map((a) => ({
            bounds: {
              x: a.bounds?.x ?? 0,
              y: a.bounds?.y ?? 0,
              width: a.bounds?.width ?? 0,
              height: a.bounds?.height ?? 0,
            },
            action: {
              type: a.action?.type ?? '',
              label: a.action?.label,
              uri: a.action?.uri,
              data: a.action?.data,
              text: a.action?.text,
              richMenuAliasId: a.action?.richMenuAliasId,
              inputOption: a.action?.inputOption,
              displayText: a.action?.displayText,
            },
          })),
        },
        imageUrl,
      }
    },
    enabled: Boolean(oaId),
  })

  useEffect(() => {
    return () => {
      if (data?.imageUrl) {
        URL.revokeObjectURL(data.imageUrl)
      }
    }
  }, [data?.imageUrl])

  return {
    richMenu: data?.richMenu ?? null,
    imageUrl: data?.imageUrl ?? null,
    isLoading,
  }
}
