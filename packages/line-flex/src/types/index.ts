// ============ Spacing & Sizing ============

export type LFexSize =
  | 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'
  | '3xl' | '4xl' | '5xl' | 'full'

export type LFexSpacing = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'
export type LFexMargin = LFexSpacing
export type LFexGravity = 'top' | 'bottom' | 'center'
export type LFexAlign = 'start' | 'end' | 'center'
export type LFexDecoration = 'none' | 'underline' | 'line-through'
export type LFexWeight = 'regular' | 'bold'
export type LFexStyle = 'normal' | 'italic'
export type LFexPosition = 'relative' | 'absolute'
export type LFexLayout = 'horizontal' | 'vertical' | 'baseline'
export type LFexAspectRatio =
  | '1:1' | '1.51:1' | '1.91:1' | '4:3' | '16:9'
  | '20:13' | '2:1' | '3:1' | '3:4' | '9:16' | '1:2' | '1:3'
export type LFexAspectMode = 'cover' | 'fit'
export type LFexBubbleSize = 'nano' | 'micro' | 'deca' | 'hecto' | 'kilo' | 'mega' | 'giga'
export type LFexButtonStyle = 'link' | 'primary' | 'secondary'
export type LFexButtonHeight = 'sm' | 'md'
export type LFexBorderWidth = 'none' | 'light' | 'normal' | 'medium' | 'semi-bold' | 'bold'

// ============ Actions ============

export interface LFexURIAction {
  type: 'uri'
  label?: string
  uri: string
  altUri?: { desktop?: string }
}

export interface LFexMessageAction {
  type: 'message'
  label?: string
  text: string
}

export interface LFexPostbackAction {
  type: 'postback'
  label?: string
  data: string
  displayText?: string
}

export type LFexAction = LFexURIAction | LFexMessageAction | LFexPostbackAction

// ============ Background ============

export interface LFexBackground {
  type: 'linearGradient'
  angle: string
  startColor: string
  endColor: string
  centerColor?: string
  centerPosition?: string
}

// ============ Components ============

export interface LFexBox {
  type: 'box'
  layout: LFexLayout
  contents: LFexComponent[]
  flex?: number
  spacing?: LFexSpacing | string
  margin?: LFexMargin | string
  paddingAll?: string
  paddingTop?: string
  paddingBottom?: string
  paddingStart?: string
  paddingEnd?: string
  position?: LFexPosition
  offsetTop?: string
  offsetBottom?: string
  offsetStart?: string
  offsetEnd?: string
  backgroundColor?: string
  borderColor?: string
  borderWidth?: LFexBorderWidth | string
  cornerRadius?: string
  width?: string
  maxWidth?: string
  height?: string
  maxHeight?: string
  justifyContent?: LFexJustifyContent
  alignItems?: LFexAlignItems
  background?: LFexBackground
  action?: LFexAction
}

export interface LFexButton {
  type: 'button'
  action: LFexAction
  flex?: number
  margin?: LFexMargin | string
  position?: LFexPosition
  offsetTop?: string
  offsetBottom?: string
  offsetStart?: string
  offsetEnd?: string
  height?: LFexButtonHeight
  style?: LFexButtonStyle
  color?: string
  gravity?: LFexGravity
  adjustMode?: 'shrink-to-fit'
}

export interface LFexFiller {
  type: 'filler'
  flex?: number
}

export interface LFexIcon {
  type: 'icon'
  url: string
  size?: LFexSize | string
  aspectRatio?: LFexAspectRatio
  margin?: LFexMargin | string
  position?: LFexPosition
  offsetTop?: string
  offsetBottom?: string
  offsetStart?: string
  offsetEnd?: string
}

export interface LFexImage {
  type: 'image'
  url: string
  flex?: number
  margin?: LFexMargin | string
  position?: LFexPosition
  offsetTop?: string
  offsetBottom?: string
  offsetStart?: string
  offsetEnd?: string
  align?: LFexAlign
  gravity?: LFexGravity
  size?: LFexSize | string
  aspectRatio?: LFexAspectRatio
  aspectMode?: LFexAspectMode
  backgroundColor?: string
  action?: LFexAction
}

export interface LFexSeparator {
  type: 'separator'
  margin?: LFexMargin | string
  color?: string
}

export interface LFexSpacer {
  type: 'spacer'
  size?: LFexSize | string
}

export interface LFexText {
  type: 'text'
  text: string
  contents?: LFexSpan[]
  flex?: number
  margin?: LFexMargin | string
  position?: LFexPosition
  offsetTop?: string
  offsetBottom?: string
  offsetStart?: string
  offsetEnd?: string
  size?: LFexSize | string
  align?: LFexAlign
  gravity?: LFexGravity
  wrap?: boolean
  maxLines?: number
  weight?: LFexWeight
  color?: string
  style?: LFexStyle
  decoration?: LFexDecoration
  lineSpacing?: string
  action?: LFexAction
}

export interface LFexSpan {
  type: 'span'
  text: string
  size?: LFexSize | string
  color?: string
  weight?: LFexWeight
  style?: LFexStyle
  decoration?: LFexDecoration
}

export interface LFexVideo {
  type: 'video'
  url: string
  previewUrl: string
  altContent?: LFexImage | LFexBox
  aspectRatio?: LFexAspectRatio
  action?: LFexAction
}

export type LFexComponent =
  | LFexBox
  | LFexButton
  | LFexFiller
  | LFexIcon
  | LFexImage
  | LFexSeparator
  | LFexSpacer
  | LFexText
  | LFexVideo

// ============ Containers ============

export interface LFexBubbleStyles {
  header?: { backgroundColor?: string }
  hero?: { backgroundColor?: string }
  body?: { backgroundColor?: string }
  footer?: { backgroundColor?: string }
}

export interface LFexBubble {
  type: 'bubble'
  size?: LFexBubbleSize
  direction?: 'ltr' | 'rtl'
  header?: LFexBox
  hero?: LFexBox | LFexImage | LFexVideo
  body?: LFexBox
  footer?: LFexBox
  styles?: LFexBubbleStyles
  action?: LFexAction
}

export interface LFexCarousel {
  type: 'carousel'
  contents: LFexBubble[]
}

export interface LFexMessage {
  type: 'flex'
  altText: string
  contents: LFexBubble | LFexCarousel
}

// ============ Layout ============

export type LFexJustifyContent =
  | 'flex-start' | 'flex-end' | 'center'
  | 'space-between' | 'space-around' | 'space-evenly'

export type LFexAlignItems = 'flex-start' | 'flex-end' | 'center' | 'baseline' | 'stretch'