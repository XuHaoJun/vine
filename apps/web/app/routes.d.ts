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
        | `/(app)/developers/console`
        | `/(app)/developers/console/`
        | `/(app)/developers/flex-simulator`
        | `/(app)/developers/flex-simulator/`
        | `/(app)/developers/flex-simulator/FlexSimulatorHeaderContext`
        | `/(app)/developers/flex-simulator/FlexSimulatorPreview`
        | `/(app)/developers/flex-simulator/FlexSimulatorSendDialog`
        | `/(app)/home`
        | `/(app)/home/(tabs)`
        | `/(app)/home/(tabs)/main`
        | `/(app)/home/(tabs)/main/`
        | `/(app)/home/(tabs)/main/settings`
        | `/(app)/home/(tabs)/talks`
        | `/(app)/home/(tabs)/talks/`
        | `/(app)/home/(tabs)/talks/requests`
        | `/(app)/home/main`
        | `/(app)/home/main/`
        | `/(app)/home/main/settings`
        | `/(app)/home/talks`
        | `/(app)/home/talks/`
        | `/(app)/home/talks/requests`
        | `/(app)/manager/[oaId]/richmenu`
        | `/(app)/manager/[oaId]/richmenu/create`
        | `/_sitemap`
        | `/auth`
        | `/auth/consent`
        | `/auth/login`
        | `/auth/login/password`
        | `/auth/oauth-callback`
        | `/developers/console`
        | `/developers/console/`
        | `/developers/flex-simulator`
        | `/developers/flex-simulator/`
        | `/developers/flex-simulator/FlexSimulatorHeaderContext`
        | `/developers/flex-simulator/FlexSimulatorPreview`
        | `/developers/flex-simulator/FlexSimulatorSendDialog`
        | `/hello`
        | `/home`
        | `/home/(tabs)`
        | `/home/(tabs)/main`
        | `/home/(tabs)/main/`
        | `/home/(tabs)/main/settings`
        | `/home/(tabs)/talks`
        | `/home/(tabs)/talks/`
        | `/home/(tabs)/talks/requests`
        | `/home/main`
        | `/home/main/`
        | `/home/main/settings`
        | `/home/talks`
        | `/home/talks/`
        | `/home/talks/requests`
        | `/manager/[oaId]/richmenu`
        | `/manager/[oaId]/richmenu/create`
      DynamicRoutes: 
        | `/(app)/auth/signup/${OneRouter.SingleRoutePart<T>}`
        | `/(app)/developers/console/channel/${OneRouter.SingleRoutePart<T>}`
        | `/(app)/developers/console/provider/${OneRouter.SingleRoutePart<T>}`
        | `/(app)/home/(tabs)/talks/${OneRouter.SingleRoutePart<T>}`
        | `/(app)/home/talks/${OneRouter.SingleRoutePart<T>}`
        | `/(app)/manager/${OneRouter.SingleRoutePart<T>}`
        | `/(app)/manager/${OneRouter.SingleRoutePart<T>}/richmenu/${OneRouter.SingleRoutePart<T>}`
        | `/(app)/oa/${OneRouter.SingleRoutePart<T>}`
        | `/auth/signup/${OneRouter.SingleRoutePart<T>}`
        | `/developers/console/channel/${OneRouter.SingleRoutePart<T>}`
        | `/developers/console/provider/${OneRouter.SingleRoutePart<T>}`
        | `/home/(tabs)/talks/${OneRouter.SingleRoutePart<T>}`
        | `/home/talks/${OneRouter.SingleRoutePart<T>}`
        | `/manager/${OneRouter.SingleRoutePart<T>}`
        | `/manager/${OneRouter.SingleRoutePart<T>}/richmenu/${OneRouter.SingleRoutePart<T>}`
        | `/oa/${OneRouter.SingleRoutePart<T>}`
      DynamicRouteTemplate: 
        | `/(app)/auth/signup/[method]`
        | `/(app)/developers/console/channel/[channelId]`
        | `/(app)/developers/console/provider/[providerId]`
        | `/(app)/home/(tabs)/talks/[chatId]`
        | `/(app)/home/talks/[chatId]`
        | `/(app)/manager/[oaId]`
        | `/(app)/manager/[oaId]/richmenu/[richMenuId]`
        | `/(app)/oa/[oaId]`
        | `/auth/signup/[method]`
        | `/developers/console/channel/[channelId]`
        | `/developers/console/provider/[providerId]`
        | `/home/(tabs)/talks/[chatId]`
        | `/home/talks/[chatId]`
        | `/manager/[oaId]`
        | `/manager/[oaId]/richmenu/[richMenuId]`
        | `/oa/[oaId]`
      IsTyped: true
      RouteTypes: {
        '/(app)/auth/signup/[method]': RouteInfo<{ method: string }>
        '/(app)/developers/console/channel/[channelId]': RouteInfo<{ channelId: string }>
        '/(app)/developers/console/provider/[providerId]': RouteInfo<{ providerId: string }>
        '/(app)/home/(tabs)/talks/[chatId]': RouteInfo<{ chatId: string }>
        '/(app)/home/talks/[chatId]': RouteInfo<{ chatId: string }>
        '/(app)/manager/[oaId]': RouteInfo<{ oaId: string }>
        '/(app)/manager/[oaId]/richmenu/[richMenuId]': RouteInfo<{ oaId: string; richMenuId: string }>
        '/(app)/oa/[oaId]': RouteInfo<{ oaId: string }>
        '/auth/signup/[method]': RouteInfo<{ method: string }>
        '/developers/console/channel/[channelId]': RouteInfo<{ channelId: string }>
        '/developers/console/provider/[providerId]': RouteInfo<{ providerId: string }>
        '/home/(tabs)/talks/[chatId]': RouteInfo<{ chatId: string }>
        '/home/talks/[chatId]': RouteInfo<{ chatId: string }>
        '/manager/[oaId]': RouteInfo<{ oaId: string }>
        '/manager/[oaId]/richmenu/[richMenuId]': RouteInfo<{ oaId: string; richMenuId: string }>
        '/oa/[oaId]': RouteInfo<{ oaId: string }>
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