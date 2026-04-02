# SDK for Flutter

**Source:** https://pub.dev/documentation/flutter_line_sdk/latest/flutter_line_sdk/
**Section:** LINE Login SDKs

**Description:** API reference for integrating LINE Login using the Flutter SDK.

---

<!DOCTYPE html>
<html lang="en"><head><script type="text/javascript" src="https://www.googletagmanager.com/gtm.js?id=GTM-MX6DBN9" async="async"></script><script type="text/javascript" src="/static/hash-qdshfgq0/js/gtm.js"></script><meta charset="utf-8"/><meta http-equiv="X-UA-Compatible" content="IE=edge"/><meta name="viewport" content="width=device-width, height=device-height, initial-scale=1, user-scalable=no"/><meta name="generator" content="made with love by dartdoc"/><meta name="description" content="flutter_line_sdk library API docs, for the Dart programming language."/><title>flutter_line_sdk library - Dart API</title><link rel="canonical" href="https://pub.dev/documentation/flutter_line_sdk/latest/flutter_line_sdk"/><link rel="preconnect" href="https://fonts.gstatic.com"/><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto+Mono:ital,wght@0,300;0,400;0,500;0,700;1,400&amp;display=swap"/><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0"/><link rel="stylesheet" href="/static/hash-qdshfgq0/css/dartdoc.css"/><link rel="icon" href="/favicon.ico?hash=nk4nss8c7444fg0chird9erqef2vkhb8"/></head><body class="light-theme" data-base-href="../" data-using-base-href="false"><noscript><iframe class="-gtm-iframe" src="https://www.googletagmanager.com/ns.html?id=GTM-MX6DBN9" height="0" width="0"></iframe></noscript><script src="/static/hash-qdshfgq0/js/dark-init.js"></script><div id="overlay-under-drawer"></div><header id="title"><span id="sidenav-left-toggle" class="material-symbols-outlined" role="button" tabindex="0">menu</span><a class="hidden-xs" href="/"><img class="-dart-logo-img" src="/static/hash-qdshfgq0/img/dart-logo.svg" alt="" width="30" height="30" role="presentation" aria-label="Go to the landing page of pub.dev"/></a><ol class="breadcrumbs gt-separated dark hidden-xs"><li><a href="/packages/flutter_line_sdk">flutter_line_sdk package</a></li><li><a href="../index.html">documentation</a></li><li class="self-crumb">flutter_line_sdk.dart</li></ol><div class="self-name">flutter_line_sdk.dart</div><form class="search navbar-right" role="search"><input id="search-box" class="form-control typeahead" type="text" placeholder="Loading search..." autocomplete="off"/></form><button id="theme-button" class="toggle" aria-label="Light and dark mode toggle" title="Toggle between light and dark mode"><span id="dark-theme-button" class="material-symbols-outlined" aria-hidden="true">dark_mode</span><span id="light-theme-button" class="material-symbols-outlined" aria-hidden="true">light_mode</span></button></header><main><div id="dartdoc-main-content" class="main-content" data-above-sidebar="" data-below-sidebar="flutter_line_sdk/flutter_line_sdk-library-sidebar.html">
  
    <div>
      

      <h1>
        <span class="kind-library">flutter_line_sdk</span>
        library 
 

      </h1>
    </div>

    
<div class="desc markdown markdown-body">
  <p>A Flutter plugin for using the LINE SDKs with Dart in Flutter apps.</p>
<p>This package is a Dart/Flutter compatible wrapper for using the
<a href="https://developers.line.biz/en/docs/ios-sdk/swift/overview/" rel="ugc nofollow">LINE SDK for iOS Swift</a> and
<a href="https://developers.line.biz/en/docs/android-sdk/overview/" rel="ugc nofollow">LINE SDK for Android</a> in your
Flutter app.
To use this plugin and LINE's APIs, you need to register and configure a channel in the
<a href="https://developers.line.biz/console/" rel="ugc nofollow">LINE Developers console</a>. For details, see
<a href="https://developers.line.biz/en/docs/line-login/getting-started/" rel="ugc nofollow">Getting started with LINE Login</a>.</p>
<p>After installing this flutter_line_sdk package, update your Xcode Runner project and Android
<code>build.gradle</code> file with your channel information. For details, see the "Linking your app to
your channel" section in our setup guides for
<a href="https://developers.line.biz/en/docs/ios-sdk/swift/setting-up-project/" rel="ugc nofollow">iOS</a> and
<a href="https://developers.line.biz/en/docs/android-sdk/integrate-line-login/" rel="ugc nofollow">Android</a>.</p>
<p>After that, use an <code>import</code> directive to include flutter_line_sdk in your project and call
<code>await LineSDK.instance.setup($channel_id);</code> to set up the plugin. For the most basic use case,
invoke the <code>login</code> method to prompt your users to log in with their LINE accounts.</p>
</div>


    <div class="summary offset-anchor" id="classes">
      <h2>Classes</h2>
      <dl>
          <dt id="AccessToken">
  <span class="name "><a href="../flutter_line_sdk/AccessToken-class.html">AccessToken</a></span> 

</dt>
<dd>
  An access token used to access the LINE Platform.
</dd>

          <dt id="AccessTokenVerifyResult">
  <span class="name "><a href="../flutter_line_sdk/AccessTokenVerifyResult-class.html">AccessTokenVerifyResult</a></span> 

</dt>
<dd>
  Response to <a href="../flutter_line_sdk/LineSDK/verifyAccessToken.html">LineSDK.verifyAccessToken</a>.
</dd>

          <dt id="BotFriendshipStatus">
  <span class="name "><a href="../flutter_line_sdk/BotFriendshipStatus-class.html">BotFriendshipStatus</a></span> 

</dt>
<dd>
  Response to <a href="../flutter_line_sdk/LineSDK/getBotFriendshipStatus.html">LineSDK.getBotFriendshipStatus</a>.
</dd>

          <dt id="LineSDK">
  <span class="name "><a href="../flutter_line_sdk/LineSDK-class.html">LineSDK</a></span> 

</dt>
<dd>
  A general manager class for LINE SDK login features.
</dd>

          <dt id="LoginOption">
  <span class="name "><a href="../flutter_line_sdk/LoginOption-class.html">LoginOption</a></span> 

</dt>
<dd>
  Options related to LINE login process.
</dd>

          <dt id="LoginResult">
  <span class="name "><a href="../flutter_line_sdk/LoginResult-class.html">LoginResult</a></span> 

</dt>
<dd>
  The result of a successful login, containing basic user information and an access token.
</dd>

          <dt id="StoredAccessToken">
  <span class="name "><a href="../flutter_line_sdk/StoredAccessToken-class.html">StoredAccessToken</a></span> 

</dt>
<dd>
  The access token stored on the user's device.
</dd>

          <dt id="UserProfile">
  <span class="name "><a href="../flutter_line_sdk/UserProfile-class.html">UserProfile</a></span> 

</dt>
<dd>
  The user profile used in LineSDK.
</dd>

      </dl>
    </div>









  </div><div id="dartdoc-sidebar-left" class="sidebar sidebar-offcanvas-left"><header id="header-search-sidebar" class="hidden-l"><form class="search-sidebar" role="search"><input id="search-sidebar" class="form-control typeahead" type="text" placeholder="Loading search..." autocomplete="off"/></form></header><ol id="sidebar-nav" class="breadcrumbs gt-separated dark hidden-l"><li><a href="/packages/flutter_line_sdk">flutter_line_sdk package</a></li><li><a href="../index.html">documentation</a></li><li class="self-crumb">flutter_line_sdk.dart</li></ol>
    <!-- The search input and breadcrumbs below are only responsively visible at low resolutions. -->



    <h5><span class="package-name">flutter_line_sdk</span> <span class="package-kind">package</span></h5>
    <ol>
      <li class="section-title">Libraries</li>
      <li><a href="../flutter_line_sdk/">flutter_line_sdk</a></li>
</ol>

  </div><div id="dartdoc-sidebar-right" class="sidebar sidebar-offcanvas-right">
    <h5>flutter_line_sdk library</h5>
  </div></main><footer><span class="no-break">flutter_line_sdk 2.7.0</span></footer><script src="/static/hash-qdshfgq0/dartdoc/resources/highlight.pack.js"></script><script src="/static/hash-qdshfgq0/dartdoc/resources/docs.dart.js"></script></body></html>