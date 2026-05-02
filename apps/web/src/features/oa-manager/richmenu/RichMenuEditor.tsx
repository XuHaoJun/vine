import { memo, useCallback, useRef, useState } from 'react'
import { Platform } from 'react-native'
import { Controller, useForm } from 'react-hook-form'
import { valibotResolver } from '@hookform/resolvers/valibot'
import * as v from 'valibot'
import { randomUUID } from 'expo-crypto'
import { SizableText, XStack, YStack } from 'tamagui'
import { Image } from 'react-native'

import { validateRichMenu, type RichMenuAction } from '@vine/richmenu-schema'
import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'
import { showError } from '~/interface/dialogs/actions'
import { showToast } from '~/interface/toast/Toast'
import { oaClient } from '~/features/oa/client'

import { AreaOverlay } from './AreaOverlay'
import { TEMPLATES } from './templates'
import type { Area, AreaBounds, EditorState, MenuSize } from './types'
import { boundsToProto } from './types'

const SettingsSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1, 'Required'), v.maxLength(30, 'Max 30 chars')),
  chatBarText: v.pipe(v.string(), v.maxLength(14, 'Max 14 chars')),
  size: v.picklist(['2500x1686', '2500x843'] as const),
  selected: v.boolean(),
})
type SettingsForm = v.InferInput<typeof SettingsSchema>

const DEFAULT_ACTION: RichMenuAction = { type: 'message', text: '' }

type EditorMode =
  | { mode: 'create'; oaId: string; onSaved: (richMenuId: string) => void }
  | {
      mode: 'edit'
      oaId: string
      richMenuId: string
      initial: EditorState
      onSaved: () => void
    }

type Props = EditorMode

export const RichMenuEditor = memo((props: Props) => {
  const initialState: EditorState =
    props.mode === 'edit'
      ? props.initial
      : {
          name: '',
          size: '2500x1686',
          chatBarText: '',
          selected: false,
          areas: [],
          selectedAreaId: null,
          imageDataUrl: null,
          imageChanged: false,
        }

  const { control, handleSubmit, watch, setValue } = useForm<SettingsForm>({
    resolver: valibotResolver(SettingsSchema),
    defaultValues: {
      name: initialState.name,
      chatBarText: initialState.chatBarText,
      size: initialState.size,
      selected: initialState.selected,
    },
  })

  const size = watch('size') as MenuSize
  const canvasHeightPx = size === '2500x1686' ? 1686 : 843

  const [areas, setAreas] = useState<Area[]>(initialState.areas)
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null)
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(
    initialState.imageDataUrl,
  )
  const [imageChanged, setImageChanged] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [containerWidth, setContainerWidth] = useState(500)
  const scaleFactor = containerWidth / 2500
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const selectedArea = areas.find((a) => a.id === selectedAreaId) ?? null

  const [actionType, setActionType] = useState<'message' | 'uri' | 'postback' | 'richmenuswitch'>('message')
  const [actionText, setActionText] = useState('')
  const [actionUri, setActionUri] = useState('')
  const [actionData, setActionData] = useState('')
  const [actionDisplayText, setActionDisplayText] = useState('')
  const [actionRichMenuAliasId, setActionRichMenuAliasId] = useState('')

  const handleSelectArea = useCallback(
    (id: string) => {
      setSelectedAreaId(id)
      const area = areas.find((a) => a.id === id)
      if (!area) return
      const act = area.action
      setActionType(act.type as 'message' | 'uri' | 'postback' | 'richmenuswitch')
      setActionText(act.type === 'message' ? act.text : '')
      setActionUri(act.type === 'uri' ? act.uri : '')
      setActionData(act.type === 'postback' ? act.data : '')
      setActionDisplayText(act.type === 'postback' ? (act.displayText ?? '') : '')
      if (act.type === 'richmenuswitch') {
        setActionRichMenuAliasId(act.richMenuAliasId ?? '')
        setActionData(act.data ?? '')
      }
    },
    [areas],
  )

  const commitAction = useCallback(() => {
    if (!selectedAreaId) return
    let action: RichMenuAction
    if (actionType === 'message') {
      action = { type: 'message', text: actionText }
    } else if (actionType === 'uri') {
      action = { type: 'uri', uri: actionUri }
    } else if (actionType === 'richmenuswitch') {
      action = {
        type: 'richmenuswitch',
        richMenuAliasId: actionRichMenuAliasId,
        data: actionData,
      }
    } else {
      action = {
        type: 'postback',
        data: actionData,
        displayText: actionDisplayText || undefined,
      }
    }
    setAreas((prev) => prev.map((a) => (a.id === selectedAreaId ? { ...a, action } : a)))
  }, [selectedAreaId, actionType, actionText, actionUri, actionData, actionDisplayText, actionRichMenuAliasId])

  const handleUpdateBounds = useCallback((id: string, bounds: AreaBounds) => {
    setAreas((prev) => prev.map((a) => (a.id === id ? { ...a, bounds } : a)))
  }, [])

  const handleDeleteArea = useCallback(
    (id: string) => {
      setAreas((prev) => prev.filter((a) => a.id !== id))
      if (selectedAreaId === id) setSelectedAreaId(null)
    },
    [selectedAreaId],
  )

  const handleAddArea = () => {
    const newArea: Area = {
      id: randomUUID(),
      bounds: { x: 0, y: 0, w: Math.round(2500 / 3), h: canvasHeightPx },
      action: DEFAULT_ACTION,
    }
    setAreas((prev) => [...prev, newArea])
    setSelectedAreaId(newArea.id)
    handleSelectArea(newArea.id)
  }

  const handleApplyTemplate = (templateBounds: AreaBounds[]) => {
    const newAreas: Area[] = templateBounds.map((bounds, i) => ({
      id: areas[i]?.id ?? randomUUID(),
      bounds,
      action: areas[i]?.action ?? DEFAULT_ACTION,
    }))
    setAreas(newAreas)
    setSelectedAreaId(null)
    setShowTemplates(false)
  }

  const handleImagePick = () => {
    if (Platform.OS === 'web') {
      fileInputRef.current?.click()
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = ev.target?.result
      if (typeof result === 'string') {
        setImageDataUrl(result)
        setImageChanged(true)
      }
    }
    reader.readAsDataURL(file)
  }

  const onSubmit = handleSubmit(async (settings) => {
    const validation = validateRichMenu({
      size: { width: 2500, height: canvasHeightPx },
      selected: settings.selected,
      name: settings.name,
      chatBarText: settings.chatBarText,
      areas: areas.map((a) => ({
        bounds: boundsToProto(a.bounds),
        action: a.action,
      })),
    })
    if (!validation.success) {
      showError(
        new Error(validation.errors.map((e) => e.message).join(', ')),
        'Validation failed',
      )
      return
    }

    setIsSaving(true)
    try {
      const areaPayload = areas.map((a) => ({
        bounds: boundsToProto(a.bounds),
        action: {
          type: a.action.type,
          label: 'label' in a.action ? a.action.label : undefined,
          uri: 'uri' in a.action ? a.action.uri : undefined,
          data: 'data' in a.action ? a.action.data : undefined,
          text: 'text' in a.action ? a.action.text : undefined,
          displayText:
            'displayText' in a.action ? (a.action as any).displayText : undefined,
          richMenuAliasId:
            'richMenuAliasId' in a.action ? (a.action as any).richMenuAliasId : undefined,
        },
      }))

      let richMenuId: string

      if (props.mode === 'create') {
        const res = await oaClient.createRichMenu({
          officialAccountId: props.oaId,
          name: settings.name,
          chatBarText: settings.chatBarText,
          selected: settings.selected,
          sizeWidth: 2500,
          sizeHeight: canvasHeightPx,
          areas: areaPayload,
        })
        richMenuId = res.richMenuId
      } else {
        await oaClient.updateRichMenu({
          officialAccountId: props.oaId,
          richMenuId: props.richMenuId,
          name: settings.name,
          chatBarText: settings.chatBarText,
          selected: settings.selected,
          sizeWidth: 2500,
          sizeHeight: canvasHeightPx,
          areas: areaPayload,
        })
        richMenuId = props.richMenuId
      }

      if (imageChanged && imageDataUrl) {
        try {
          const [header, b64] = imageDataUrl.split(',')
          if (!header || !b64) {
            showToast('Image upload failed — re-upload to activate', { type: 'warn' })
            return
          }
          const mimeMatch = header.match(/data:(image\/[a-z]+);base64/)
          const contentType = mimeMatch?.[1] ?? 'image/jpeg'
          const binary = atob(b64)
          const bytes = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i)
          }
          await oaClient.uploadRichMenuImage({
            officialAccountId: props.oaId,
            richMenuId,
            image: bytes,
            contentType,
          })
        } catch {
          showToast('Image upload failed — re-upload to activate', { type: 'warn' })
        }
      }

      if (props.mode === 'create') {
        props.onSaved(richMenuId)
      } else {
        props.onSaved()
      }
    } catch (e) {
      showError(e, 'Failed to save menu')
    } finally {
      setIsSaving(false)
    }
  })

  const AREA_LABELS = 'ABCDEFGHIJKLMNOPQRST'

  return (
    <YStack gap="$4">
      <XStack gap="$4" flexWrap="wrap" items="flex-end">
        <YStack gap="$1" style={{ minWidth: 160 }}>
          <SizableText size="$1" color="$color10">
            Title (management only)
          </SizableText>
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <Input
                value={value}
                onChangeText={onChange}
                placeholder="My Menu"
                error={error?.message}
              />
            )}
          />
        </YStack>

        <YStack gap="$1">
          <SizableText size="$1" color="$color10">
            Size
          </SizableText>
          <Controller
            control={control}
            name="size"
            render={({ field: { onChange, value } }) => (
              <XStack gap="$2">
                {(['2500x1686', '2500x843'] as MenuSize[]).map((s) => (
                  <Button
                    key={s}
                    size="$2"
                    variant={value === s ? undefined : 'outlined'}
                    onPress={() => onChange(s)}
                  >
                    {s === '2500x1686' ? 'Large' : 'Small'}
                  </Button>
                ))}
              </XStack>
            )}
          />
        </YStack>

        <YStack gap="$1" style={{ minWidth: 120 }}>
          <SizableText size="$1" color="$color10">
            Chat bar text
          </SizableText>
          <Controller
            control={control}
            name="chatBarText"
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <Input
                value={value}
                onChangeText={onChange}
                placeholder="Menu"
                error={error?.message}
              />
            )}
          />
        </YStack>

        <Controller
          control={control}
          name="selected"
          render={({ field: { onChange, value } }) => (
            <XStack gap="$2" items="center" pb="$2">
              <Button
                size="$2"
                variant={value ? undefined : 'outlined'}
                onPress={() => onChange(!value)}
              >
                {value ? 'Default expanded ✓' : 'Default expanded'}
              </Button>
            </XStack>
          )}
        />
      </XStack>

      <XStack gap="$4" items="flex-start">
        <YStack flex={1} gap="$2" style={{ minWidth: 0 }}>
          <XStack gap="$2" flexWrap="wrap">
            <Button size="$2" onPress={handleImagePick}>
              Upload image
            </Button>
            <Button
              size="$2"
              variant="outlined"
              onPress={() => setShowTemplates((v) => !v)}
            >
              Template
            </Button>
            <Button size="$2" variant="outlined" onPress={handleAddArea}>
              + Add area
            </Button>
          </XStack>

          {showTemplates && (
            <YStack
              borderWidth={1}
              borderColor="$borderColor"
              rounded="$3"
              p="$3"
              gap="$2"
            >
              <SizableText size="$2" fontWeight="600" color="$color11">
                Templates for {size}
              </SizableText>
              <XStack flexWrap="wrap" gap="$2">
                {(TEMPLATES[size] ?? []).map((tpl) => (
                  <Button
                    key={tpl.label}
                    size="$2"
                    variant="outlined"
                    onPress={() => handleApplyTemplate(tpl.bounds)}
                  >
                    {tpl.label}
                  </Button>
                ))}
              </XStack>
            </YStack>
          )}

          <YStack
            position="relative"
            width="100%"
            bg="$color3"
            rounded="$2"
            overflow="hidden"
            borderWidth={1}
            borderColor="$borderColor"
            style={{ aspectRatio: 2500 / canvasHeightPx }}
            onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
          >
            {imageDataUrl ? (
              <Image
                source={{ uri: imageDataUrl }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                }}
                resizeMode="cover"
              />
            ) : (
              <YStack
                position="absolute"
                t={0}
                l={0}
                r={0}
                b={0}
                items="center"
                justify="center"
              >
                <SizableText size="$1" color="$color9">
                  [ Rich menu image {size} ]
                </SizableText>
              </YStack>
            )}

            {areas.map((area, i) => (
              <AreaOverlay
                key={area.id}
                area={area}
                label={AREA_LABELS[i] ?? String(i + 1)}
                scaleFactor={scaleFactor}
                isSelected={selectedAreaId === area.id}
                canvasHeightPx={canvasHeightPx}
                onSelect={handleSelectArea}
                onUpdate={handleUpdateBounds}
                onDelete={handleDeleteArea}
              />
            ))}
          </YStack>

          <SizableText size="$1" color="$color9">
            Click to select · Drag to move · Drag corner to resize · × to delete
          </SizableText>
        </YStack>

        {selectedArea && (
          <YStack
            width={200}
            shrink={0}
            gap="$3"
            borderWidth={1}
            borderColor="$borderColor"
            rounded="$3"
            p="$3"
          >
            <SizableText size="$3" fontWeight="700" color="$color12">
              Area {AREA_LABELS[areas.findIndex((a) => a.id === selectedAreaId)] ?? '?'}{' '}
              (selected)
            </SizableText>

            <YStack gap="$1">
              <SizableText size="$1" color="$color10">
                Action type
              </SizableText>
              <XStack gap="$1" flexWrap="wrap">
                {(['message', 'uri', 'postback', 'richmenuswitch'] as const).map((t) => (
                  <Button
                    key={t}
                    size="$2"
                    variant={actionType === t ? undefined : 'outlined'}
                    onPress={() => setActionType(t)}
                  >
                    {t === 'message'
                      ? 'Message'
                      : t === 'uri'
                        ? 'URI'
                        : t === 'postback'
                          ? 'Postback'
                          : 'Switch'}
                  </Button>
                ))}
              </XStack>
            </YStack>

            {actionType === 'message' && (
              <YStack gap="$1">
                <SizableText size="$1" color="$color10">
                  Text
                </SizableText>
                <Input
                  value={actionText}
                  onChangeText={setActionText}
                  placeholder="Hello!"
                />
              </YStack>
            )}

            {actionType === 'uri' && (
              <YStack gap="$1">
                <SizableText size="$1" color="$color10">
                  URL
                </SizableText>
                <Input
                  value={actionUri}
                  onChangeText={setActionUri}
                  placeholder="https://example.com"
                />
              </YStack>
            )}

            {actionType === 'postback' && (
              <>
                <YStack gap="$1">
                  <SizableText size="$1" color="$color10">
                    Data
                  </SizableText>
                  <Input
                    value={actionData}
                    onChangeText={setActionData}
                    placeholder="action=buy"
                  />
                </YStack>
                <YStack gap="$1">
                  <SizableText size="$1" color="$color10">
                    Display text (optional)
                  </SizableText>
                  <Input
                    value={actionDisplayText}
                    onChangeText={setActionDisplayText}
                    placeholder="Buy"
                  />
                </YStack>
              </>
            )}

            {actionType === 'richmenuswitch' && (
              <>
                <YStack gap="$1">
                  <SizableText size="$1" color="$color10">
                    Alias ID
                  </SizableText>
                  <Input
                    value={actionRichMenuAliasId}
                    onChangeText={setActionRichMenuAliasId}
                    placeholder="richmenu-alias-a"
                  />
                </YStack>
                <YStack gap="$1">
                  <SizableText size="$1" color="$color10">
                    Data
                  </SizableText>
                  <Input value={actionData} onChangeText={setActionData} placeholder="tab=a" />
                </YStack>
              </>
            )}

            <YStack gap="$1">
              <SizableText size="$1" color="$color10">
                Position (px)
              </SizableText>
              <XStack gap="$1" flexWrap="wrap">
                {(['x', 'y', 'w', 'h'] as const).map((key) => (
                  <YStack key={key} width={44}>
                    <SizableText size="$1" color="$color9">
                      {key.toUpperCase()}
                    </SizableText>
                    <Input
                      value={String(selectedArea.bounds[key])}
                      onChangeText={(v) => {
                        const n = parseInt(v, 10)
                        if (!isNaN(n)) {
                          setAreas((prev) =>
                            prev.map((a) =>
                              a.id === selectedArea.id
                                ? { ...a, bounds: { ...a.bounds, [key]: n } }
                                : a,
                            ),
                          )
                        }
                      }}
                    />
                  </YStack>
                ))}
              </XStack>
            </YStack>

            <Button onPress={commitAction}>Apply action</Button>
          </YStack>
        )}
      </XStack>

      <XStack gap="$3" justify="flex-end">
        <Button variant="outlined" onPress={() => history.back()}>
          Cancel
        </Button>
        <Button onPress={onSubmit} disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
      </XStack>

      {Platform.OS === 'web' && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      )}
    </YStack>
  )
})
