---
name: developers-line-biz
description: "LY Corporation provides an API (hereafter referred to as the LINE API) that enables external companies and developers to connect with LY Corporation services. The LINE Developers site (https://developers.line.biz/) provides documentation explaining the LINE API's specifications and development procedures. Contains 228 reference documents organized into sections: Docs, LINE Platform basics, LINE Developers Console, Messaging API, LINE Social Plugins, LINE Login, LINE Login SDKs, LINE Front-end Framework (LIFF), LINE MINI App, Options for corporate customers, Optional."
version: 1.0.0
---

# LINE Developers site (LINE Platform Documentation)

## Overview

LY Corporation provides an API (hereafter referred to as the LINE API) that enables external companies and developers to connect with LY Corporation services. The LINE Developers site (https://developers.line.biz/) provides documentation explaining the LINE API's specifications and development procedures.

## How to Use This Skill

This skill contains 228 reference documents organized by topic. When you need information about LINE Developers site (LINE Platform Documentation):

1. Claude will automatically access relevant reference files based on your question
2. Reference files are organized in the `references/` directory by topic
3. Each reference contains detailed documentation extracted from the official source

## Reference Documentation

### Docs

- [LINE Platform basics](references/line_platform_basics.md) - An introductory guide outlining the fundamental concepts and key components of the LINE Platform, with links to its core features.
- [LINE Developers Console](references/line_developers_console.md) - An overview of the LINE Developers Console, showing how to create channels, manage roles, and configure settings for the LINE Platform services.
- [Messaging API](references/messaging_api.md) - Explains how to use the Messaging API to create bots, send messages, and gather statistics while interacting securely with LINE users.
- [LINE Social Plugins](references/line_social_plugins.md) - Details tools such as Share, Like, and Add friend button to connect websites or blogs with LINE and boost social engagement.
- [LINE Login](references/line_login.md) - Describes LINE Login, a secure OAuth 2.0-based authentication method that allows users to sign in to apps or websites using their LINE accounts.
- [LINE Front-end Framework (LIFF)](references/line_front_end_framework_liff.md) - Introduces LIFF (LINE Front-end Framework), which enables web apps within LINE to access user data, send messages, and more. Includes setup guides.
- [LINE MINI App](references/line_mini_app.md) - An overview of the LINE MINI App, which allows services to run inside LINE without requiring downloads. Explains the development flow, features, and submission steps.

### LINE Platform basics

- [Channel access token](references/channel_access_token.md) - Describes how to issue and use channel access tokens for LINE API authentication.
- [Get user profile information](references/get_user_profile_information.md) - Explains how to retrieve user profile information using the LINE API.
- [Check the availability of the LINE Platform (LINE API Status)](references/check_the_availability_of_the_line_platform_line_api_status.md) - Provides the current status and availability information for the LINE API and platform services.

### LINE Developers Console

- [LINE Developers Console overview](references/line_developers_console_overview.md) - Overview of the LINE Developers Console, a UI for managing channels and providers.
- [Log in to LINE Developers](references/log_in_to_line_developers.md) - Explains how to log in and access the LINE Developers Console.
- [Managing roles](references/managing_roles.md) - Guidance on managing user roles and permissions in the LINE Developers Console.
- [Best practices for provider and channel management](references/best_practices_for_provider_and_channel_management.md) - Best practices for effectively organizing and maintaining providers and channels.
- [Receive notifications via email or the notification center](references/receive_notifications_via_email_or_the_notification_center.md) - Instructions for setting up alerts via email or the notification center.

### Messaging API

- [Messaging API reference](references/messaging_api_reference.md) - A comprehensive reference for Messaging API endpoints, parameters, and JSON schemas.
- [Messaging API development guidelines](references/messaging_api_development_guidelines.md) - Official guidelines for using the Messaging API, including rate limits and error handling.
- [Messaging API overview](references/messaging_api_overview.md) - An overview of the Messaging API and its capabilities for interacting with LINE users.
- [Message types](references/message_types.md) - Details the various message formats supported by the Messaging API.
- [Get started with the Messaging API](references/get_started_with_the_messaging_api.md) - A step-by-step guide for getting started with the Messaging API.
- [Issue channel access token v2.1](references/issue_channel_access_token_v21.md) - Explains how to sign a JWT and issue a channel access token v2.1 to authenticate requests.
- [Build a bot](references/build_a_bot.md) - Describes how to build a bot that can send and receive messages using the Messaging API and webhooks.
- [Messaging API pricing](references/messaging_api_pricing.md) - Lists free and paid plans, message quotas, and additional fees for using the Messaging API.
- [Send messages](references/send_messages.md) - Describes how to send messages using the Messaging API.
- [Character counting in a text](references/character_counting_in_a_text.md) - Explains how characters are counted in text messages, including handling of multibyte characters, emoji, and newlines.
- [Get user IDs](references/get_user_ids.md) - Shows how to retrieve a user ID or group ID from webhook events and endpoints.
- [Stickers](references/stickers.md) - A complete catalog of sticker and package IDs that can be used in the Messaging API.
- [LINE emoji](references/line_emoji.md) - A searchable list of LINE emoji IDs and code points for use in the Messaging API.
- [Use audiences](references/use_audiences.md) - Explains how to create, upload, and target audiences for narrowcast messages.
- [Use quick replies](references/use_quick_replies.md) - Guides you through implementing quick replies in LINE bot conversations.
- [Get statistics of sent messages](references/get_statistics_of_sent_messages.md) - Explains how to access usage statistics for sent messages.
- [Use LINE features with the LINE URL scheme](references/use_line_features_with_the_line_url_scheme.md) - Shows how to launch LINE features such as chat, add friend, or open LIFF apps using URL schemes.
- [Use beacons with LINE](references/use_beacons_with_line.md) - Describes how to trigger messages based on user proximity using BLE beacons and beacon events.
- [Gain friends of your LINE Official Account](references/gain_friends_of_your_line_official_account.md) - Guides you on increasing friends via share links, QR codes.
- [User account linking](references/user_account_linking.md) - Enables users to securely link their LINE accounts with external service accounts using a linking token.
- [Customize icon and display name](references/customize_icon_and_display_name.md) - Allows customizing the bot's icon and display name per message for personalization.
- [Display a loading animation](references/display_a_loading_animation.md) - Describes how to show a loading indicator while the bot processes events or replies.
- [Use membership features](references/use_membership_features.md) - Explains how to implement and manage membership levels and perks.
- [Create coupons and send them to users](references/create_coupons_and_send_them_to_users.md) - Explains how to create coupons using the Messaging API and send them to users as messages from your LINE Official Account.
- [Get quote tokens](references/get_quote_tokens.md) - Covers how to retrieve and use quote tokens to reply to specific messages.
- [Mark messages as read](references/mark_messages_as_read.md) - Explains how to mark a message as read programmatically in the LINE app
- [Retry failed API requests](references/retry_failed_api_requests.md) - Explains retry strategies for failed API requests, including idempotency and retry limits.
- [Stop using your LINE Official Account](references/stop_using_your_line_official_account.md) - Guides you through deactivating or deleting your LINE Official Account and API access.
- [Stop using the Messaging API](references/stop_using_the_messaging_api.md) - Describes how to shut down your use of the Messaging API properly.
- [Measure impressions](references/measure_impressions.md) - Describes how the Messaging API measures message impressions and the conditions required for them to be counted.
- [Tutorial - Make a reply bot](references/tutorial___make_a_reply_bot.md) - A hands-on tutorial for building a simple LINE bot using Node.js to reply to messages.
- [Receive messages (webhook)](references/receive_messages_webhook.md) - How to receive messages from users via webhooks.
- [Verify webhook URL](references/verify_webhook_url.md) - Steps to verify your webhook endpoint.
- [Verify webhook signature](references/verify_webhook_signature.md) - Explains how to validate webhook signatures using HMAC-SHA256.
- [Check webhook error causes and statistics](references/check_webhook_error_causes_and_statistics.md) - Tools and methods for monitoring webhook errors and delivery statistics.
- [SSL/TLS specification of the webhook source](references/ssltls_specification_of_the_webhook_source.md) - SSL/TLS requirements for webhook endpoints to ensure secure communication.
- [Rich menus overview](references/rich_menus_overview.md) - Introduction to rich menus and how they enhance user experience.
- [Use rich menus](references/use_rich_menus.md) - Describes how to configure and link rich menus to LINE Official Accounts.
- [Use per-user rich menus](references/use_per_user_rich_menus.md) - Explains how to assign personalized rich menus to individual users.
- [Switch between tabs on rich menus](references/switch_between_tabs_on_rich_menus.md) - Shows how to implement tab switching in rich menus for multi-section navigation.
- [Play with rich menus](references/play_with_rich_menus.md) - An interactive tool to preview and test rich menu behaviors.
- [LINE Bot Designer](references/line_bot_designer.md) - A guide to designing and testing bots using the visual LINE Bot Designer interface.
- [Download LINE Bot Designer](references/download_line_bot_designer.md) - Download instructions and system requirements for the LINE Bot Designer.
- [Send Flex Messages](references/send_flex_messages.md) - How to send rich, customizable message layouts using Flex Messages.
- [Flex Message elements](references/flex_message_elements.md) - Explains the UI components used in Flex Messages, such as box, text, image, and button.
- [Flex Message layout](references/flex_message_layout.md) - Layout rules and best practices for designing responsive Flex Messages.
- [Create a Flex Message including a video](references/create_a_flex_message_including_a_video.md) - Describes how to embed videos in Flex Messages for richer engagement.
- [Tutorial - Create a digital business card with Flex Message Simulator](references/tutorial___create_a_digital_business_card_with_flex_message_simulator.md) - A tutorial for testing and previewing Flex Messages with the simulator.
- [Flex Message Simulator](references/flex_message_simulator.md) - An online tool to visually build and test Flex Messages.
- [Actions](references/actions.md) - Describes interactive actions like postback, URI, message, and camera.
- [Group chats and multi-person chats](references/group_chats_and_multi_person_chats.md) - Explains how to handle events in group and multi-person chat, including joins, leaves, and message handling.
- [Consent on getting user profile information](references/consent_on_getting_user_profile_information.md) - Details how to obtain user consent before accessing LINE profile data.
- [LINE Beacon device specification](references/line_beacon_device_specification.md) - Technical specifications for BLE beacon devices that trigger proximity events in the LINE app.
- [Sample code and data for generating secure messages](references/sample_code_and_data_for_generating_secure_messages.md) - Example code and data for creating encrypted, secure messages.
- [LINE Messaging API SDKs](references/line_messaging_api_sdks.md) - Lists official LINE Bot SDKs (Node.js, Java, Python, etc.) and links to the GitHub repositories.
- [SkillBox technical case study: LINE notifications greatly increased usage rate of engagement surveys, even for employees without email addresses](references/skillbox_technical_case_study_line_notifications_greatly_increased_usage_rate_of_engagement_surveys_even_for_employees_without_email_addresses.md) - A technical case study by HRCOM Co. Ltd. on using LINE notifications with SkillBox to significantly increase employee engagement survey participation rates.
- [A case study on the development of "Resort Baito Dive" to enhance temporary staff satisfaction](references/a_case_study_on_the_development_of_resort_baito_dive_to_enhance_temporary_staff_satisfaction.md) - A technical case study by Dive Inc. on how it used the Messaging API to improve communication and satisfaction among temporary staff in the tourism industry.
- [A case study of developing a LINE bot to handle inquiries related to relocation and settlement](references/a_case_study_of_developing_a_line_bot_to_handle_inquiries_related_to_relocation_and_settlement.md) - A technical case study by heptagon inc. on building a LINE bot to handle relocation and settlement inquiries, supporting digital transformation for companies.
- [Technical case study of anybot for ChatGPT: achieving smoother communication by fully leveraging ChatGPT](references/technical_case_study_of_anybot_for_chatgpt_achieving_smoother_communication_by_fully_leveraging_chatgpt.md) - Case study of a LINE MINI App integrating ChatGPT for smoother business communication.
- [Technical case study of Smart Public Lab: LINE utilization strategy supporting administrative digital transformation](references/technical_case_study_of_smart_public_lab_line_utilization_strategy_supporting_administrative_digital_transformation.md) - Case study of a municipal digital service platform delivered via a messaging app, enabling online applications, reservations, and targeted notifications.
- [Introducing infrastructure as low code for LINE-based service development case study on improving development efficiency with CNAP](references/introducing_infrastructure_as_low_code_for_line_based_service_development_case_study_on_improving_development_efficiency_with_cnap.md) - A technical case study by SoftBank on using CNAP to speed up infrastructure provisioning and enable self-service for a LINE Messaging API inquiry system.
- [A LINE MINI App case study of an on-demand autonomous bus reservation system](references/a_line_mini_app_case_study_of_an_on_demand_autonomous_bus_reservation_system.md) - A technical case study by BOLDLY on an on-demand autonomous bus booking system on LINE, integrating ride reservations with real-time monitoring data.

### LINE Social Plugins

- [LINE Social Plugins overview](references/line_social_plugins_overview.md) - An overview of LINE Social Plugins for sharing content and connecting users on your website.
- [Usage Guidelines for the LINE Social Plugin](references/usage_guidelines_for_the_line_social_plugin.md) - Outlines rules and restrictions for using LINE Social Plugins, including prohibited use cases and branding requirements.
- [Using Share buttons](references/using_share_buttons.md) - Instructions for integrating Share buttons into your website.
- [Using Add friend buttons](references/using_add_friend_buttons.md) - A guide to adding Add Friend buttons to encourage user engagement.
- [Using Like buttons](references/using_like_buttons.md) - Describes how to implement Like buttons for interactive user feedback.
- [Release notes](references/release_notes.md) - A list of release history and updates for LINE Social Plugins.
- [Design guide](references/design_guide.md) - Provides design standards and best practices for implementing LINE Social Plugin buttons and components.

### LINE Login

- [LINE Login v2.1 API reference](references/line_login_v21_api_reference.md) - API reference for LINE Login v2.1, covering endpoints for authentication, token exchange, and user profile retrieval.
- [LINE Login development guidelines](references/line_login_development_guidelines.md) - Official development guide for building secure and user-friendly LINE Login integrations.
- [LINE Login security checklist](references/line_login_security_checklist.md) - A checklist of security best practices to ensure safe implementation of LINE Login.
- [LINE Login overview](references/line_login_overview.md) - Summary of LINE Login features and how it streamlines user authentication across devices.
- [Getting started with LINE Login](references/getting_started_with_line_login.md) - Step-by-step instructions for setting up and testing LINE Login in your app or website.
- [Integrating LINE Login with your web app](references/integrating_line_login_with_your_web_app.md) - Guide to adding LINE Login to a web app using the standard OAuth 2.0 flow and SDK tools.
- [How to handle auto login failure](references/how_to_handle_auto_login_failure.md) - Suggestions for resolving issues when auto login fails due to session expiration or browser settings.
- [PKCE support for LINE Login](references/pkce_support_for_line_login.md) - Explains how to implement PKCE (Proof Key for Code Exchange) to enhance security for public clients.
- [Add a LINE Official Account as a friend when logged in (add friend option)](references/add_a_line_official_account_as_a_friend_when_logged_in_add_friend_option.md) - Shows how to automatically prompt users to add a LINE Official Account after logging in.
- [Creating a secure login process between your app and server](references/creating_a_secure_login_process_between_your_app_and_server.md) - Explains how to securely exchange ID tokens between your client and server after login.
- [Managing access tokens](references/managing_access_tokens.md) - Instructions on how to verify, refresh, and revoke LINE Login access tokens securely.
- [Get profile information from ID tokens](references/get_profile_information_from_id_tokens.md) - Explains how to decode and validate ID tokens to extract user profile data.
- [Managing users](references/managing_users.md) - Guide for managing LINE Login users, including logout handling and access revocation.
- [Managing authorized apps](references/managing_authorized_apps.md) - Covers how users and developers can view or revoke app authorizations granted via LINE Login.
- [LINE Login button](references/line_login_button.md) - Design and implementation guide for adding a LINE Login button to your app or website.
- [Using LINE features with the LINE URL scheme](references/using_line_features_with_the_line_url_scheme.md) - Demonstrates how to launch LINE actions such as opening chats or apps using custom URL schemes.

### LINE Login SDKs

- [LINE SDK for iOS Swift](references/line_sdk_for_ios_swift.md) - API reference for integrating LINE Login using the LINE SDK for iOS (Swift).
- [LINE SDK for Android](references/line_sdk_for_android.md) - API reference for integrating LINE Login using the LINE SDK for Android.
- [LINE SDK for Unity](references/line_sdk_for_unity.md) - API reference for integrating LINE Login using the LINE SDK for Unity.
- [SDK for Flutter](references/sdk_for_flutter.md) - API reference for integrating LINE Login using the Flutter SDK.
- [LINE SDK for iOS Swift overview](references/line_sdk_for_ios_swift_overview.md) - Overview of the LINE SDK for iOS (Swift) for integrating LINE Login.
- [Trying the starter app](references/trying_the_starter_app.md) - Guide to quickly testing LINE Login using a prebuilt iOS sample app.
- [Setting up your project](references/setting_up_your_project.md) - Instructions for configuring your iOS project to use the LINE SDK.
- [Using universal links](references/using_universal_links.md) - How to support universal links when integrating LINE Login on iOS.
- [Integrating LINE Login](references/integrating_line_login.md) - Steps to implement LINE Login using the LINE SDK for iOS (Swift).
- [Enabling the add friend option with the SDK](references/enabling_the_add_friend_option_with_the_sdk.md) - How to prompt users to add a LINE Official Account during login on iOS using the SDK.
- [Managing users](references/managing_users.md) - Guide to logging out and unlinking LINE Login users on iOS using the SDK.
- [Managing access tokens](references/managing_access_tokens.md) - How to validate and refresh LINE Login access tokens on iOS.
- [Handling errors](references/handling_errors.md) - Describes error types and error-handling methods in the iOS SDK.
- [Using the SDK with Objective-C code](references/using_the_sdk_with_objective_c_code.md) - How to integrate the Swift SDK into existing Objective-C code.
- [Upgrading the SDK](references/upgrading_the_sdk.md) - Migration guide for upgrading to the latest version of the LINE SDK for iOS (Swift).
- [LINE SDK for Android overview](references/line_sdk_for_android_overview.md) - Overview of the LINE SDK for Android for integrating LINE Login.
- [Trying the sample app](references/trying_the_sample_app.md) - How to test LINE Login using a sample Android project.
- [Integrating LINE Login](references/integrating_line_login.md) - Guide for implementing LINE Login in an Android app using the SDK.
- [Enabling the add friend option with the SDK](references/enabling_the_add_friend_option_with_the_sdk.md) - How to prompt users to add a LINE Official Account during login on Android using the SDK.
- [Managing users](references/managing_users.md) - Guide to logging out and unlinking LINE Login users on Android via the SDK.
- [Managing access tokens](references/managing_access_tokens.md) - How to validate and refresh LINE Login access tokens on Android.
- [Handling errors](references/handling_errors.md) - Describes error types and handling strategies in the Android SDK.
- [LINE SDK for Unity overview](references/line_sdk_for_unity_overview.md) - Overview of the LINE SDK for Unity for integrating LINE Login.
- [Setting up your project](references/setting_up_your_project.md) - Steps to set up a Unity project to use the LINE SDK.
- [Trying the starter app](references/trying_the_starter_app.md) - How to run a sample Unity app with LINE Login integration.
- [Integrating LINE Login with your Unity game](references/integrating_line_login_with_your_unity_game.md) - Full guide for integrating LINE Login into a Unity game.
- [Using LINE SDK for other APIs and result handling](references/using_line_sdk_for_other_apis_and_result_handling.md) - Instructions for using the LINE SDK in Unity projects.
- [LINE SDK for Flutter](references/line_sdk_for_flutter.md) - Overview of the LINE SDK for Flutter and its capabilities.
- [Release notes for LINE SDK for iOS](references/release_notes_for_line_sdk_for_ios.md) - Release history and update logs for the LINE SDK for iOS.
- [Release notes for LINE SDK for Android](references/release_notes_for_line_sdk_for_android.md) - Release history and update logs for the LINE SDK for Android.
- [Release notes for LINE SDK for Unity](references/release_notes_for_line_sdk_for_unity.md) - Release history and update logs for the LINE SDK for Unity.
- [LINE API SDKs](references/line_api_sdks.md) - Download page for all LINE SDKs and development tools.

### LINE Front-end Framework (LIFF)

- [LIFF v2 API reference](references/liff_v2_api_reference.md) - API reference detailing the methods and properties available in the LIFF SDK.
- [LIFF Server API](references/liff_server_api.md) - Server-side API for managing LIFF apps.
- [LIFF app development guidelines](references/liff_app_development_guidelines.md) - Best practices for building responsive, secure, and user-friendly LIFF apps.
- [LINE Front-end Framework (LIFF)](references/line_front_end_framework_liff.md) - Introduction to LIFF and how web apps run on the LIFF browser inside the LINE app.
- [Create a channel](references/create_a_channel.md) - Guide to setting up a LINE Login channel to deploy and test your LIFF app.
- [Trying the LIFF starter app](references/trying_the_liff_starter_app.md) - Tutorial for testing a prebuilt LIFF app using the starter kit.
- [Building a LIFF app development environment with Create LIFF App](references/building_a_liff_app_development_environment_with_create_liff_app.md) - CLI-based tool for quickly scaffolding a LIFF development project.
- [Developing a LIFF app](references/developing_a_liff_app.md) - Step-by-step guide for implementing front-end functionality in a LIFF app.
- [Adding a LIFF app to your channel](references/adding_a_liff_app_to_your_channel.md) - Instructions for linking your LIFF app to a LINE Login channel via the LINE Developers Console.
- [Opening a LIFF app](references/opening_a_liff_app.md) - Describes how users can launch a LIFF app using a URL or QR code.
- [Minimizing LIFF browser](references/minimizing_liff_browser.md) - Explains how to minimize the LIFF browser window from within the app.
- [Using user data in LIFF apps and servers](references/using_user_data_in_liff_apps_and_servers.md) - How to securely access and use LINE user profile data in your LIFF app and back-end.
- [The differences between LIFF browser and LINE's in-app browser](references/the_differences_between_liff_browser_and_lines_in_app_browser.md) - Explains key behavioral differences between the LIFF browser and LINE's in-app browser.
- [The differences between the LIFF browser and external browser](references/the_differences_between_the_liff_browser_and_external_browser.md) - Explains key behavioral differences between the LIFF browser and standard mobile browsers.
- [LIFF plugin](references/liff_plugin.md) - APIs and tools for extending LIFF apps using plugin modules.
- [Pluggable SDK](references/pluggable_sdk.md) - The pluggable SDK is a feature that allows you to choose which LIFF APIs to include in the LIFF SDK.
- [LIFF CLI](references/liff_cli.md) - Command-line tool for building, testing, and deploying LIFF apps efficiently.
- [LIFF Playground](references/liff_playground.md) - Online sandbox for experimenting with LIFF APIs without local setup.
- [Versioning policy](references/versioning_policy.md) - Outlines LIFF versioning strategy and backward compatibility policy.
- [Release notes](references/release_notes.md) - Changelog of updates, fixes, and new features for LIFF.

### LINE MINI App

- [LINE MINI App API reference](references/line_mini_app_api_reference.md) - API reference for LINE MINI Apps, covering endpoints and parameters.
- [LINE MINI App development guidelines](references/line_mini_app_development_guidelines.md) - Best practices and technical guidance for developing LINE MINI Apps.
- [Get started with LINE MINI App](references/get_started_with_line_mini_app.md) - Introductory guide for creating and deploying a LINE MINI App.
- [Introducing LINE MINI App](references/introducing_line_mini_app.md) - Overview of LINE MINI Apps and how they run inside the LINE app.
- [LINE Developers Console Guide for LINE MINI App](references/line_developers_console_guide_for_line_mini_app.md) - Instructions for managing LINE MINI Apps via the LINE Developers Console.
- [Specifications](references/specifications.md) - Technical specifications of LINE MINI Apps.
- [Built-in features](references/built_in_features.md) - Lists features available natively within LINE MINI Apps.
- [Custom Features](references/custom_features.md) - Explains how developers can extend LINE MINI Apps with custom features.
- [LINE MINI App UI components](references/line_mini_app_ui_components.md) - UI components available for building LINE MINI Apps.
- [The differences between native apps and LINE MINI Apps](references/the_differences_between_native_apps_and_line_mini_apps.md) - Compares LINE MINI Apps and native apps, and explains how MINI Apps deliver web-like experiences within LINE and can be extended with other LINE APIs.
- [LINE MINI App icon specifications and guidelines](references/line_mini_app_icon_specifications_and_guidelines.md) - Specifications and guidelines for LINE MINI App icons.
- [Safe area of LINE MINI App](references/safe_area_of_line_mini_app.md) - Notes on maintaining proper layout within LINE MINI App's safe display areas.
- [Loading icon](references/loading_icon.md) - Design guidelines for loading indicators in LINE MINI Apps.
- [Getting started](references/getting_started.md) - Overview of the development flow and environment setup for LINE MINI Apps.
- [Implementing a custom action button](references/implementing_a_custom_action_button.md) - How to create buttons for sharing messages from your LINE MINI App.
- [Sending service messages](references/sending_service_messages.md) - How to send service messages to users.
- [Configuring Custom Path](references/configuring_custom_path.md) - How to customize the LIFF URL in your LINE MINI App.
- [LINE MINI App authorization flow](references/line_mini_app_authorization_flow.md) - Explains how the Channel consent simplification feature in LINE MINI Apps streamlines authorization by skipping the channel consent screen for the openid scope and requesting other scopes via the verification screen.
- [Handling payments](references/handling_payments.md) - Guide to implementing payment features within LINE MINI Apps.
- [Creating permanent links](references/creating_permanent_links.md) - How to create permanent URLs that launch specific content in your LINE MINI App.
- [Add a shortcut to your LINE MINI App to the home screen of the user's device](references/add_a_shortcut_to_your_line_mini_app_to_the_home_screen_of_the_users_device.md) - Let users pin LINE MINI Apps to their device's home screen.
- [Managing LINE MINI App settings on LINE Developers Console](references/managing_line_mini_app_settings_on_line_developers_console.md) - How to configure app settings via the LINE Developers Console.
- [Open a LINE MINI App in an external browser](references/open_a_line_mini_app_in_an_external_browser.md) - Instructions for launching LINE MINI Apps outside of the LINE app.
- [Implementing web apps in operation as LINE MINI Apps](references/implementing_web_apps_in_operation_as_line_mini_apps.md) - How to adapt existing web apps for use as LINE MINI Apps with minimal changes.
- [Performance guidelines](references/performance_guidelines.md) - Tips for optimizing performance in LINE MINI Apps.
- [Overview of Quick-fill](references/overview_of_quick_fill.md) - Introduction to the Quick-fill feature for auto-filling forms in LINE MINI Apps.
- [Quick-fill design regulations](references/quick_fill_design_regulations.md) - UI/UX guidelines for designing Quick-fill forms.
- [In-app purchase overview](references/in_app_purchase_overview.md) - Introduction to the in-app purchase feature of LINE MINI Apps.
- [In-app purchase development guidelines](references/in_app_purchase_development_guidelines.md) - Best practices and technical guidance for integrating the in-app purchase feature into LINE MINI Apps.
- [Apply to use in-app purchase](references/apply_to_use_in_app_purchase.md) - Explains how to apply for and set up the in-app purchase feature.
- [Set up in-app purchase](references/set_up_in_app_purchase.md) - Explains how to set up the webhook URL and register in-app purchase testers.
- [Integrate the in-app purchase feature](references/integrate_the_in_app_purchase_feature.md) - Instructions for integrating the in-app purchase feature into LINE MINI Apps.
- [Submitting LINE MINI App](references/submitting_line_mini_app.md) - Explains the process for submitting and publishing your LINE MINI App.
- [LINE MINI App policy](references/line_mini_app_policy.md) - Terms and policies governing the use of LINE MINI Apps.
- [Running your service](references/running_your_service.md) - Guide to maintaining and operating your LINE MINI App after launch.
- [Place ads in LINE MINI Apps](references/place_ads_in_line_mini_apps.md) - How to monetize LINE MINI Apps using Yahoo! JAPAN Ads, available for both verified and unverified apps.
- [Re-review after updating your verified MINI App](references/re_review_after_updating_your_verified_mini_app.md) - What to do when updating a previously verified LINE MINI App.
- [Use LINE Official Account](references/use_line_official_account.md) - How to use a LINE Official Account to enhance your LINE MINI App's user experience.
- [LINE MINI App Playground](references/line_mini_app_playground.md) - An interactive tool for testing and previewing LINE MINI App UI and features.
- [Store reservation demo](references/store_reservation_demo.md) - Demo of store reservations (e.g., salons/restaurants) with reminder notifications via LINE messages.
- [Table order demo](references/table_order_demo.md) - Demo of ordering and payment with LINE Official Account integration for promotions.
- [Membership card demo](references/membership_card_demo.md) - Demo of digital membership cards and targeted push messages to members.
- [Event experience demo](references/event_experience_demo.md) - Demo integrating ticketing, routing (mixway API), and entry into a single LINE MINI App.
- [Mobile experience demo](references/mobile_experience_demo.md) - Demo of personalized mobility using TraISARE data, including ticketing and recommendations.
- [Purchase experience demo](references/purchase_experience_demo.md) - Smart retail OMO demo with mobile checkout, digital membership, and purchase history.
- [Travel experience demo](references/travel_experience_demo.md) - MaaS demo covering pre-trip booking/payment, in-trip routing, and post-trip follow-ups.
- [Nature conservation through play: A technical case study of Letters from the Forest launched on the LINE MINI App](references/nature_conservation_through_play_a_technical_case_study_of_letters_from_the_forest_launched_on_the_line_mini_app.md) - Case study of a Web3-based nature conservation LINE MINI App.
- [How queue management solutions are scaling with the LINE MINI App: The development use case of "matoca" and "yoboca"](references/how_queue_management_solutions_are_scaling_with_the_line_mini_app_the_development_use_case_of_matoca_and_yoboca.md) - Case study of waitlist and queue notifications delivered via LINE MINI Apps.
- [A case study of mobile order system CX ORDER](references/a_case_study_of_mobile_order_system_cx_order.md) - Case study of a mobile ordering service built with LINE MINI Apps.
- [Technical case study of the GDL platform: achieving both cost-efficiency and flexibility](references/technical_case_study_of_the_gdl_platform_achieving_both_cost_efficiency_and_flexibility.md) - Case study of a cost-efficient, flexible dev platform built with LINE MINI App tech.
- [A development case study of "PoHUNT," a digital revitalization initiative for mobility and health promotion in Asahi Town, Toyama Prefecture](references/a_development_case_study_of_pohunt_a_digital_revitalization_initiative_for_mobility_and_health_promotion_in_asahi_town_toyama_prefecture.md) - HAKUHODO technical case study on “PoHUNT,” a LINE MINI App that gamifies mobility and wellness with QR-code points, rewards, and integration with a public ride-sharing service.

### Options for corporate customers

- [Option API reference for corporate customers](references/option_api_reference_for_corporate_customers.md) - Entry point to documentation for APIs available only to corporate users who have submitted the required applications.
- [LINE notification messages API reference](references/line_notification_messages_api_reference.md) - API reference for sending LINE notification messages to users.
- [Development guidelines for corporate customers](references/development_guidelines_for_corporate_customers.md) - Best practices and rules for securely and effectively using the options for corporate customers API.
- [LINE API Policy Handbook](references/line_api_policy_handbook.md) - In-depth guide to LINE API usage policies, terms, and restrictions.
- [Notice for corporate customers](references/notice_for_corporate_customers.md) - Important notices and updates for corporate users of the LINE Platform.
- [Overview](references/overview.md) - General overview of the options for corporate customers API and available features.
- [Error Notification](references/error_notification.md) - Guide to error codes and delivery failure notifications.
- [Provider page](references/provider_page.md) - Instructions for managing your provider page via the LINE Developers Console.
- [Mission Stickers API](references/mission_stickers_api.md) - Guide to using the Mission Stickers API.
- [LINE Profile+](references/line_profile.md) - Enables collection of custom user attributes beyond the default LINE profile.
- [LINE Beacon](references/line_beacon.md) - Explains the user-side requirements for receiving LINE Beacon events, including Bluetooth activation, OS version compatibility, and consent via LINE app settings.
- [Mark as read API (old)](references/mark_as_read_api_old.md) - Explains how to mark a message as read programmatically in the LINE app using the old Mark as Read API.
- [LINE notification messages overview](references/line_notification_messages_overview.md) - Overview of LINE notification messages, which allow sending messages to users by phone number.
- [LINE notification messages (template)](references/line_notification_messages_template.md) - Describes the format and structure of templates used when sending LINE notification messages (template).
- [Technical specifications of the LINE notification messages API](references/technical_specifications_of_the_line_notification_messages_api.md) - Technical documentation for the LINE notification messages API.
- [Webhook delivery completion event](references/webhook_delivery_completion_event.md) - Explains webhook events that confirm successful message delivery.
- [Flow when receiving a LINE notification message](references/flow_when_receiving_a_line_notification_message.md) - Explains the user experience and technical flow when a message is received.
- [Module](references/module.md) - Overview of the module feature for dynamic chatbot control and logic distribution.
- [Attach Module Channel](references/attach_module_channel.md) - How to attach a module channel to route logic externally.
- [Configure module channel settings](references/configure_module_channel_settings.md) - Guide for configuring module settings in the LINE Developers Console.
- [Control chat initiative (Chat Control)](references/control_chat_initiative_chat_control.md) - Allows modules to control which bot responds when multiple modules are active.
- [Using the Messaging API from a module channel](references/using_the_messaging_api_from_a_module_channel.md) - Explains how modules can send Messaging API requests on behalf of the bot.

### Optional

- [About LINE Developers site](references/about_line_developers_site.md) - Introductory page describing the purpose and structure of the LINE Platform.
- [Terms and policies](references/terms_and_policies.md) - Legal terms, data usage policies, and API rules for developers using LINE services.
- [About trademarks](references/about_trademarks.md) - Trademark usage rules and attribution requirements for LINE branding and assets.

