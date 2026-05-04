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
        | `/(app)/admin/featured-shelves`
        | `/(app)/admin/payouts`
        | `/(app)/admin/sticker-reviews`
        | `/(app)/admin/trust-reports`
        | `/(app)/auth`
        | `/(app)/auth/consent`
        | `/(app)/auth/login`
        | `/(app)/auth/login/password`
        | `/(app)/auth/oauth-callback`
        | `/(app)/creator`
        | `/(app)/creator/`
        | `/(app)/creator/packages`
        | `/(app)/creator/packages/new`
        | `/(app)/creator/payouts`
        | `/(app)/creator/sales`
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
        | `/(app)/manager`
        | `/(app)/manager/[oaId]/richmenu`
        | `/(app)/manager/[oaId]/richmenu/create`
        | `/(app)/manager/[oaId]/richmenu/users`
        | `/(app)/manager/create`
        | `/(app)/pay/redirect`
        | `/(app)/pay/result`
        | `/(app)/store`
        | `/(app)/store/search`
        | `/_sitemap`
        | `/admin/featured-shelves`
        | `/admin/payouts`
        | `/admin/sticker-reviews`
        | `/admin/trust-reports`
        | `/auth`
        | `/auth/consent`
        | `/auth/login`
        | `/auth/login/password`
        | `/auth/oauth-callback`
        | `/creator`
        | `/creator/`
        | `/creator/packages`
        | `/creator/packages/new`
        | `/creator/payouts`
        | `/creator/sales`
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
        | `/manager`
        | `/manager/[oaId]/richmenu`
        | `/manager/[oaId]/richmenu/create`
        | `/manager/[oaId]/richmenu/users`
        | `/manager/create`
        | `/pay/redirect`
        | `/pay/result`
        | `/store`
        | `/store/search`
      DynamicRoutes: 
        | `/(app)/admin/sticker-reviews/${OneRouter.SingleRoutePart<T>}`
        | `/(app)/admin/trust-reports/${OneRouter.SingleRoutePart<T>}`
        | `/(app)/auth/signup/${OneRouter.SingleRoutePart<T>}`
        | `/(app)/creator/packages/${OneRouter.SingleRoutePart<T>}`
        | `/(app)/creators/${OneRouter.SingleRoutePart<T>}`
        | `/(app)/developers/console/channel/${OneRouter.SingleRoutePart<T>}`
        | `/(app)/developers/console/channel/${OneRouter.SingleRoutePart<T>}/AccessTokenSection`
        | `/(app)/developers/console/channel/${OneRouter.SingleRoutePart<T>}/ChannelHeader`
        | `/(app)/developers/console/channel/${OneRouter.SingleRoutePart<T>}/MessagingApiGuideSection`
        | `/(app)/developers/console/channel/${OneRouter.SingleRoutePart<T>}/MessagingApiQuotaSection`
        | `/(app)/developers/console/channel/${OneRouter.SingleRoutePart<T>}/MessagingApiTab`
        | `/(app)/developers/console/channel/${OneRouter.SingleRoutePart<T>}/TestWebhookSection`
        | `/(app)/developers/console/channel/${OneRouter.SingleRoutePart<T>}/WebhookErrorsSection`
        | `/(app)/developers/console/channel/${OneRouter.SingleRoutePart<T>}/WebhookErrorsSection.helpers`
        | `/(app)/developers/console/channel/${OneRouter.SingleRoutePart<T>}/WebhookSettingsSection`
        | `/(app)/developers/console/login-channel/${OneRouter.SingleRoutePart<T>}`
        | `/(app)/developers/console/login-channel/${OneRouter.SingleRoutePart<T>}/liff`
        | `/(app)/developers/console/provider/${OneRouter.SingleRoutePart<T>}`
        | `/(app)/home/(tabs)/talks/${OneRouter.SingleRoutePart<T>}`
        | `/(app)/home/talks/${OneRouter.SingleRoutePart<T>}`
        | `/(app)/liff/${OneRouter.SingleRoutePart<T>}`
        | `/(app)/liff/${OneRouter.SingleRoutePart<T>}/${OneRouter.SingleRoutePart<T>}`
        | `/(app)/liff/${string}`
        | `/(app)/manager/${OneRouter.SingleRoutePart<T>}`
        | `/(app)/manager/${OneRouter.SingleRoutePart<T>}/richmenu/${OneRouter.SingleRoutePart<T>}`
        | `/(app)/oa/${OneRouter.SingleRoutePart<T>}`
        | `/(app)/store/${OneRouter.SingleRoutePart<T>}`
        | `/(public)/invite/${OneRouter.SingleRoutePart<T>}/page`
        | `/admin/sticker-reviews/${OneRouter.SingleRoutePart<T>}`
        | `/admin/trust-reports/${OneRouter.SingleRoutePart<T>}`
        | `/auth/signup/${OneRouter.SingleRoutePart<T>}`
        | `/creator/packages/${OneRouter.SingleRoutePart<T>}`
        | `/creators/${OneRouter.SingleRoutePart<T>}`
        | `/developers/console/channel/${OneRouter.SingleRoutePart<T>}`
        | `/developers/console/channel/${OneRouter.SingleRoutePart<T>}/AccessTokenSection`
        | `/developers/console/channel/${OneRouter.SingleRoutePart<T>}/ChannelHeader`
        | `/developers/console/channel/${OneRouter.SingleRoutePart<T>}/MessagingApiGuideSection`
        | `/developers/console/channel/${OneRouter.SingleRoutePart<T>}/MessagingApiQuotaSection`
        | `/developers/console/channel/${OneRouter.SingleRoutePart<T>}/MessagingApiTab`
        | `/developers/console/channel/${OneRouter.SingleRoutePart<T>}/TestWebhookSection`
        | `/developers/console/channel/${OneRouter.SingleRoutePart<T>}/WebhookErrorsSection`
        | `/developers/console/channel/${OneRouter.SingleRoutePart<T>}/WebhookErrorsSection.helpers`
        | `/developers/console/channel/${OneRouter.SingleRoutePart<T>}/WebhookSettingsSection`
        | `/developers/console/login-channel/${OneRouter.SingleRoutePart<T>}`
        | `/developers/console/login-channel/${OneRouter.SingleRoutePart<T>}/liff`
        | `/developers/console/provider/${OneRouter.SingleRoutePart<T>}`
        | `/home/(tabs)/talks/${OneRouter.SingleRoutePart<T>}`
        | `/home/talks/${OneRouter.SingleRoutePart<T>}`
        | `/invite/${OneRouter.SingleRoutePart<T>}/page`
        | `/liff/${OneRouter.SingleRoutePart<T>}`
        | `/liff/${OneRouter.SingleRoutePart<T>}/${OneRouter.SingleRoutePart<T>}`
        | `/liff/${string}`
        | `/manager/${OneRouter.SingleRoutePart<T>}`
        | `/manager/${OneRouter.SingleRoutePart<T>}/richmenu/${OneRouter.SingleRoutePart<T>}`
        | `/oa/${OneRouter.SingleRoutePart<T>}`
        | `/store/${OneRouter.SingleRoutePart<T>}`
      DynamicRouteTemplate: 
        | `/(app)/admin/sticker-reviews/[packageId]`
        | `/(app)/admin/trust-reports/[reportId]`
        | `/(app)/auth/signup/[method]`
        | `/(app)/creator/packages/[packageId]`
        | `/(app)/creators/[creatorId]`
        | `/(app)/developers/console/channel/[channelId]`
        | `/(app)/developers/console/channel/[channelId]/AccessTokenSection`
        | `/(app)/developers/console/channel/[channelId]/ChannelHeader`
        | `/(app)/developers/console/channel/[channelId]/MessagingApiGuideSection`
        | `/(app)/developers/console/channel/[channelId]/MessagingApiQuotaSection`
        | `/(app)/developers/console/channel/[channelId]/MessagingApiTab`
        | `/(app)/developers/console/channel/[channelId]/TestWebhookSection`
        | `/(app)/developers/console/channel/[channelId]/WebhookErrorsSection`
        | `/(app)/developers/console/channel/[channelId]/WebhookErrorsSection.helpers`
        | `/(app)/developers/console/channel/[channelId]/WebhookSettingsSection`
        | `/(app)/developers/console/login-channel/[loginChannelId]`
        | `/(app)/developers/console/login-channel/[loginChannelId]/liff`
        | `/(app)/developers/console/provider/[providerId]`
        | `/(app)/home/(tabs)/talks/[chatId]`
        | `/(app)/home/talks/[chatId]`
        | `/(app)/liff/[...liffPath]`
        | `/(app)/liff/[liffId]`
        | `/(app)/liff/[liffId]/[permanentPath]`
        | `/(app)/manager/[oaId]`
        | `/(app)/manager/[oaId]/richmenu/[richMenuId]`
        | `/(app)/oa/[oaId]`
        | `/(app)/store/[packageId]`
        | `/(public)/invite/[inviteCode]/page`
        | `/admin/sticker-reviews/[packageId]`
        | `/admin/trust-reports/[reportId]`
        | `/auth/signup/[method]`
        | `/creator/packages/[packageId]`
        | `/creators/[creatorId]`
        | `/developers/console/channel/[channelId]`
        | `/developers/console/channel/[channelId]/AccessTokenSection`
        | `/developers/console/channel/[channelId]/ChannelHeader`
        | `/developers/console/channel/[channelId]/MessagingApiGuideSection`
        | `/developers/console/channel/[channelId]/MessagingApiQuotaSection`
        | `/developers/console/channel/[channelId]/MessagingApiTab`
        | `/developers/console/channel/[channelId]/TestWebhookSection`
        | `/developers/console/channel/[channelId]/WebhookErrorsSection`
        | `/developers/console/channel/[channelId]/WebhookErrorsSection.helpers`
        | `/developers/console/channel/[channelId]/WebhookSettingsSection`
        | `/developers/console/login-channel/[loginChannelId]`
        | `/developers/console/login-channel/[loginChannelId]/liff`
        | `/developers/console/provider/[providerId]`
        | `/home/(tabs)/talks/[chatId]`
        | `/home/talks/[chatId]`
        | `/invite/[inviteCode]/page`
        | `/liff/[...liffPath]`
        | `/liff/[liffId]`
        | `/liff/[liffId]/[permanentPath]`
        | `/manager/[oaId]`
        | `/manager/[oaId]/richmenu/[richMenuId]`
        | `/oa/[oaId]`
        | `/store/[packageId]`
      IsTyped: true
      RouteTypes: {
        '/(app)/admin/sticker-reviews/[packageId]': RouteInfo<{ packageId: string }>
        '/(app)/admin/trust-reports/[reportId]': RouteInfo<{ reportId: string }>
        '/(app)/auth/signup/[method]': RouteInfo<{ method: string }>
        '/(app)/creator/packages/[packageId]': RouteInfo<{ packageId: string }>
        '/(app)/creators/[creatorId]': RouteInfo<{ creatorId: string }>
        '/(app)/developers/console/channel/[channelId]': RouteInfo<{ channelId: string }>
        '/(app)/developers/console/channel/[channelId]/AccessTokenSection': RouteInfo<{ channelId: string }>
        '/(app)/developers/console/channel/[channelId]/ChannelHeader': RouteInfo<{ channelId: string }>
        '/(app)/developers/console/channel/[channelId]/MessagingApiGuideSection': RouteInfo<{ channelId: string }>
        '/(app)/developers/console/channel/[channelId]/MessagingApiQuotaSection': RouteInfo<{ channelId: string }>
        '/(app)/developers/console/channel/[channelId]/MessagingApiTab': RouteInfo<{ channelId: string }>
        '/(app)/developers/console/channel/[channelId]/TestWebhookSection': RouteInfo<{ channelId: string }>
        '/(app)/developers/console/channel/[channelId]/WebhookErrorsSection': RouteInfo<{ channelId: string }>
        '/(app)/developers/console/channel/[channelId]/WebhookErrorsSection.helpers': RouteInfo<{ channelId: string }>
        '/(app)/developers/console/channel/[channelId]/WebhookSettingsSection': RouteInfo<{ channelId: string }>
        '/(app)/developers/console/login-channel/[loginChannelId]': RouteInfo<{ loginChannelId: string }>
        '/(app)/developers/console/login-channel/[loginChannelId]/liff': RouteInfo<{ loginChannelId: string }>
        '/(app)/developers/console/provider/[providerId]': RouteInfo<{ providerId: string }>
        '/(app)/home/(tabs)/talks/[chatId]': RouteInfo<{ chatId: string }>
        '/(app)/home/talks/[chatId]': RouteInfo<{ chatId: string }>
        '/(app)/liff/[...liffPath]': RouteInfo<{ liffPath: string[] }>
        '/(app)/liff/[liffId]': RouteInfo<{ liffId: string }>
        '/(app)/liff/[liffId]/[permanentPath]': RouteInfo<{ liffId: string; permanentPath: string }>
        '/(app)/manager/[oaId]': RouteInfo<{ oaId: string }>
        '/(app)/manager/[oaId]/richmenu/[richMenuId]': RouteInfo<{ oaId: string; richMenuId: string }>
        '/(app)/oa/[oaId]': RouteInfo<{ oaId: string }>
        '/(app)/store/[packageId]': RouteInfo<{ packageId: string }>
        '/(public)/invite/[inviteCode]/page': RouteInfo<{ inviteCode: string }>
        '/admin/sticker-reviews/[packageId]': RouteInfo<{ packageId: string }>
        '/admin/trust-reports/[reportId]': RouteInfo<{ reportId: string }>
        '/auth/signup/[method]': RouteInfo<{ method: string }>
        '/creator/packages/[packageId]': RouteInfo<{ packageId: string }>
        '/creators/[creatorId]': RouteInfo<{ creatorId: string }>
        '/developers/console/channel/[channelId]': RouteInfo<{ channelId: string }>
        '/developers/console/channel/[channelId]/AccessTokenSection': RouteInfo<{ channelId: string }>
        '/developers/console/channel/[channelId]/ChannelHeader': RouteInfo<{ channelId: string }>
        '/developers/console/channel/[channelId]/MessagingApiGuideSection': RouteInfo<{ channelId: string }>
        '/developers/console/channel/[channelId]/MessagingApiQuotaSection': RouteInfo<{ channelId: string }>
        '/developers/console/channel/[channelId]/MessagingApiTab': RouteInfo<{ channelId: string }>
        '/developers/console/channel/[channelId]/TestWebhookSection': RouteInfo<{ channelId: string }>
        '/developers/console/channel/[channelId]/WebhookErrorsSection': RouteInfo<{ channelId: string }>
        '/developers/console/channel/[channelId]/WebhookErrorsSection.helpers': RouteInfo<{ channelId: string }>
        '/developers/console/channel/[channelId]/WebhookSettingsSection': RouteInfo<{ channelId: string }>
        '/developers/console/login-channel/[loginChannelId]': RouteInfo<{ loginChannelId: string }>
        '/developers/console/login-channel/[loginChannelId]/liff': RouteInfo<{ loginChannelId: string }>
        '/developers/console/provider/[providerId]': RouteInfo<{ providerId: string }>
        '/home/(tabs)/talks/[chatId]': RouteInfo<{ chatId: string }>
        '/home/talks/[chatId]': RouteInfo<{ chatId: string }>
        '/invite/[inviteCode]/page': RouteInfo<{ inviteCode: string }>
        '/liff/[...liffPath]': RouteInfo<{ liffPath: string[] }>
        '/liff/[liffId]': RouteInfo<{ liffId: string }>
        '/liff/[liffId]/[permanentPath]': RouteInfo<{ liffId: string; permanentPath: string }>
        '/manager/[oaId]': RouteInfo<{ oaId: string }>
        '/manager/[oaId]/richmenu/[richMenuId]': RouteInfo<{ oaId: string; richMenuId: string }>
        '/oa/[oaId]': RouteInfo<{ oaId: string }>
        '/store/[packageId]': RouteInfo<{ packageId: string }>
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
