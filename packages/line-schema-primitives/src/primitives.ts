import * as v from 'valibot'

export const FlexHttpsUrlSchema = v.pipe(
  v.string(),
  v.url(),
  v.startsWith('https://', 'Must use HTTPS'),
)

export const FlexUrlSchema = v.pipe(v.string(), v.url())
