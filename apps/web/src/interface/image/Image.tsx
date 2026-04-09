import { styled, Image as TamaguiImage } from 'tamagui'

// @ts-ignore - TamaguiImage type incompatibility with styled()
export const Image = styled(TamaguiImage, {
  select: 'none',
})
