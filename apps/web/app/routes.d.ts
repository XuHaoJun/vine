// deno-lint-ignore-file
/* eslint-disable */
// biome-ignore: needed import
import type { OneRouter } from 'one'

declare module 'one' {
  export namespace OneRouter {
    export interface __routes<T extends string = string> extends Record<string, unknown> {
      StaticRoutes: 
        | `/`
        | `/(app)`
        | `/(app)/auth`
        | `/(app)/auth/consent`
        | `/(app)/auth/login`
        | `/(app)/auth/login/password`
        | `/(app)/auth/oauth-callback`
        | `/(app)/home`
        | `/(app)/home/(tabs)`
        | `/(app)/home/(tabs)/talks`
        | `/(app)/home/(tabs)/talks/`
        | `/(app)/home/(tabs)/talks/requests`
        | `/(app)/home/settings`
        | `/(app)/home/settings/`
        | `/(app)/home/settings/blocked-users`
        | `/(app)/home/settings/edit-profile`
        | `/(app)/home/talks`
        | `/(app)/home/talks/`
        | `/(app)/home/talks/requests`
        | `/_sitemap`
        | `/auth`
        | `/auth/consent`
        | `/auth/login`
        | `/auth/login/password`
        | `/auth/oauth-callback`
        | `/hello`
        | `/home`
        | `/home/(tabs)`
        | `/home/(tabs)/talks`
        | `/home/(tabs)/talks/`
        | `/home/(tabs)/talks/requests`
        | `/home/settings`
        | `/home/settings/`
        | `/home/settings/blocked-users`
        | `/home/settings/edit-profile`
        | `/home/talks`
        | `/home/talks/`
        | `/home/talks/requests`
      DynamicRoutes: 
        | `/(app)/auth/signup/${OneRouter.SingleRoutePart<T>}`
        | `/(app)/home/(tabs)/talks/${OneRouter.SingleRoutePart<T>}`
        | `/(app)/home/talks/${OneRouter.SingleRoutePart<T>}`
        | `/auth/signup/${OneRouter.SingleRoutePart<T>}`
        | `/home/(tabs)/talks/${OneRouter.SingleRoutePart<T>}`
        | `/home/talks/${OneRouter.SingleRoutePart<T>}`
      DynamicRouteTemplate: 
        | `/(app)/auth/signup/[method]`
        | `/(app)/home/(tabs)/talks/[chatId]`
        | `/(app)/home/talks/[chatId]`
        | `/auth/signup/[method]`
        | `/home/(tabs)/talks/[chatId]`
        | `/home/talks/[chatId]`
      IsTyped: true
      RouteTypes: {
        '/(app)/auth/signup/[method]': RouteInfo<{ method: string }>
        '/(app)/home/(tabs)/talks/[chatId]': RouteInfo<{ chatId: string }>
        '/(app)/home/talks/[chatId]': RouteInfo<{ chatId: string }>
        '/auth/signup/[method]': RouteInfo<{ method: string }>
        '/home/(tabs)/talks/[chatId]': RouteInfo<{ chatId: string }>
        '/home/talks/[chatId]': RouteInfo<{ chatId: string }>
      }
    }
  }
}

/**
 * Helper type for route information
 */
type RouteInfo<Params = Record<string, never>> = {
  Params: Params
  LoaderProps: { path: string; search?: string; subdomain?: string; params: Params; request?: Request }
}