import { createTextExtension } from './extensions/basic'
import { createDisabledMessageExtension } from './extensions/disabled'
import { createAudioUrlExtension, createImageUrlExtension, createVideoUrlExtension } from './extensions/mediaUrl'
import { createFlexExtension } from './extensions/flex'
import type { RichMessageExtension } from './core/types'

type StarterKitOptions = {
  text?: boolean
  mediaUrl?: boolean
  flex?: boolean
  imagemap?: false | { status: 'disabled' }
  sticker?: false | { status: 'disabled' }
  location?: false | { status: 'disabled' }
}

export const RichMessageStarterKit = {
  configure(options: StarterKitOptions = {}): RichMessageExtension[] {
    const extensions: RichMessageExtension[] = []
    if (options.text !== false) extensions.push(createTextExtension())
    if (options.mediaUrl !== false) {
      extensions.push(createImageUrlExtension(), createVideoUrlExtension(), createAudioUrlExtension())
    }
    if (options.flex !== false) extensions.push(createFlexExtension())
    if (options.imagemap !== false) extensions.push(createDisabledMessageExtension('imagemap', 'Imagemap'))
    if (options.sticker !== false) extensions.push(createDisabledMessageExtension('sticker', 'Sticker'))
    if (options.location !== false) extensions.push(createDisabledMessageExtension('location', 'Location'))
    return extensions
  },
}
