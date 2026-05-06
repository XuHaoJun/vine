import type { ExpoConfig } from 'expo/config'

const appName = 'Takeout'
const appId = appName.toLowerCase()

const { APP_VARIANT = 'development' } = process.env

if (
  APP_VARIANT !== 'production' &&
  APP_VARIANT !== 'preview' &&
  APP_VARIANT !== 'development'
) {
  throw new Error(`Invalid APP_VARIANT: ${APP_VARIANT}`)
}

const IS_DEV = APP_VARIANT === 'development'

const getBundleId = () => {
  // use tamagui bundle ids for production/preview, takeout for dev
  if (APP_VARIANT === 'development') {
    return 'dev.tamagui.takeout.dev'
  } else if (APP_VARIANT === 'preview') {
    return 'dev.tamagui.takeout.preview'
  }
  return 'dev.tamagui.takeout'
}

const getAppIcon = () => {
  return './assets/icon.png'
}

const version = '0.0.1'

export default {
  expo: {
    name: `${appName}${(() => {
      switch (APP_VARIANT) {
        case 'development':
          return ' (Dev)'
        case 'preview':
          return ' (Preview)'
        case 'production':
          return ''
      }
    })()}`,
    slug: 'takeout',
    owner: 'takeout',
    scheme: appId,
    version,
    runtimeVersion: version, // must be set to use hot-updater "appVersion" update strategy
    platforms: ['ios', 'android', 'web'],
    userInterfaceStyle: 'automatic',
    icon: getAppIcon(),
    ios: {
      supportsTablet: false,
      bundleIdentifier: getBundleId(),
      icon: getAppIcon(),
      config: {
        usesNonExemptEncryption: false,
      },
      infoPlist: {
        NSPhotoLibraryAddUsageDescription:
          '$(PRODUCT_NAME) saves generated AI artwork and edited profile photos to your photo library so you can keep and share your creations.',
        NSAppleMusicUsageDescription:
          'Allow $(PRODUCT_NAME) to access your music library',
        UIBackgroundModes: ['fetch', 'remote-notification'],
      },
    },
    android: {
      package: getBundleId().replaceAll('-', '_'),
      icon: getAppIcon(),
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#e6dac1',
      },
      permissions: ['android.permission.RECORD_AUDIO'],
    },
    primaryColor: '#e6dac1',
    plugins: [
      'vxrn/expo-plugin',
      'expo-web-browser',
      'expo-font',
      'react-native-bottom-tabs',
      [
        'expo-build-properties',
        {
          ios: {
            // Keep 17.0; the native plan's 15.1 was illustrative — downgrading
            // would lose features and force pod resolution churn.
            deploymentTarget: '17.0',
          },
          android: {
            compileSdkVersion: 35,
            targetSdkVersion: 35,
          },
        },
      ],
      // Source-of-truth split for iOS permissions:
      //   - expo-* plugins below own the Info.plist *usage description strings*
      //     (the text shown in the system prompt). One string per permission;
      //     do NOT also add the matching NS*UsageDescription to ios.infoPlist
      //     above or it'll be silently overridden at prebuild time.
      //   - react-native-permissions below owns the *runtime handler pods*
      //     (RNPermissions_Camera, etc.) that the JS API calls into. It does
      //     NOT write Info.plist strings, so removing a permission from the
      //     iosPermissions array won't drop its description text.
      [
        'expo-image-picker',
        {
          photosPermission: '允許 Vine 從相簿選取照片與影片來傳送訊息。',
        },
      ],
      [
        'expo-audio',
        {
          microphonePermission: '允許 Vine 錄製語音訊息。',
        },
      ],
      [
        'expo-camera',
        {
          cameraPermission: '允許 Vine 使用相機掃描 QR Code 以新增官方帳號。',
          barcodeScannerEnabled: true,
        },
      ],
      [
        'react-native-permissions',
        {
          // Add setup_permissions to your Podfile (see iOS setup - steps 1, 2 and 3)
          iosPermissions: [
            // 'AppTrackingTransparency',
            // 'Bluetooth',
            // 'Calendars',
            // 'CalendarsWriteOnly',
            'Camera',
            // 'Contacts',
            'FaceID',
            // 'LocationAccuracy',
            // 'LocationAlways',
            // 'LocationWhenInUse',
            'MediaLibrary',
            'Microphone',
            // 'Motion',
            'Notifications',
            'PhotoLibrary',
            // 'PhotoLibraryAddOnly',
            // 'Reminders',
            // 'Siri',
            // 'SpeechRecognition',
            // 'StoreKit',
          ],
        },
      ],
      // Custom fonts
      // [
      //   'expo-font',
      //   {
      //     fonts: [
      //       './assets/fonts/Inter-Black.ttf',
      //       './assets/fonts/Inter-Bold.ttf',
      //       './assets/fonts/Inter-Light.ttf',
      //       './assets/fonts/Inter-Medium.ttf',
      //       './assets/fonts/Inter-Regular.ttf',
      //       './assets/fonts/Inter-SemiBold.ttf',
      //     ],
      //   },
      // ],
      [
        'expo-splash-screen',
        {
          backgroundColor: '#e6dac1',
          image: './assets/logo.png',
          imageWidth: 80,
          imageHeight: 80,
        },
      ],
      // hot-updater for OTA updates - uncomment and configure if needed
      // [
      //   '@hot-updater/react-native',
      //   {
      //     channel: APP_VARIANT,
      //   },
      // ],
    ],
    extra: {
      eas: {
        projectId: '9c6754b4-4688-4f51-8c28-55f0b018bc32',
      },
    },
  } satisfies ExpoConfig,
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
}
