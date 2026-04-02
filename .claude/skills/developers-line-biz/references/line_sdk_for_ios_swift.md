# LINE SDK for iOS Swift

**Source:** https://developers.line.biz/en/reference/ios-sdk-swift/
**Section:** LINE Login SDKs

**Description:** API reference for integrating LINE Login using the LINE SDK for iOS (Swift).

---

<!DOCTYPE html>
<html lang="en">
  <head>
    <title>LineSDK  Reference</title>
    <link rel="stylesheet" type="text/css" href="css/jazzy.css" />
    <link rel="stylesheet" type="text/css" href="css/highlight.css" />
    <link rel="stylesheet" type="text/css" href="css/custom.css" />
    <meta charset="utf-8">
    <script src="js/jquery.min.js" defer></script>
    <script src="js/jazzy.js" defer></script>
    <!-- Global site tag (gtag.js) - Google Analytics -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=UA-99780509-4"></script>
    <script>
      window.dataLayer = window.dataLayer || [];

      function gtag() {
        dataLayer.push(arguments);
      }
      gtag('js', new Date());

      gtag('config', 'UA-99780509-4');
    </script>
    
    <script src="js/lunr.min.js" defer></script>
    <script src="js/typeahead.jquery.js" defer></script>
    <script src="js/jazzy.search.js" defer></script>
  </head>
  <body>


    <a title="LineSDK  Reference"></a>

    <header class="header">
      <div class="header-left">
        <div>
          <a class="header-link" href="https://developers.line.biz/en/reference/ios-sdk-swift/">
            <span class="header-title">LINE SDK Docs</span>
          </a>
          
        </div>
        <nav class="GlobalHeaderNav">
          <ul>
            <li><a class="GlobalHeaderNavLink Link-blank" href="/en/" target="_blank" data-navlink="docs_site" data-translate="translate_header_menu_docs_site">LINE Developers Site</a></li>
            <li><a class="GlobalHeaderNavLink Link-blank" href="https://github.com/line/line-sdk-ios-swift/releases" target="_blank">Releases</a></li>
          </ul>
        </nav>
      </div>
    
      <p class="header-col--secondary">
        <form role="search" action="search.json">
          <input type="text" placeholder="Title search" class="doc-search" data-typeahead>
        </form>
      </p>
    
        <p class="header-col header-col--secondary">
          <a class="header-link" href="https://github.com/line/line-sdk-ios-swift">
            <img class="header-icon" src="img/gh.png"/>
            View on GitHub
          </a>
        </p>
    
    </header>

    <p class="breadcrumbs">
      <a class="breadcrumb" href="index.html">LineSDK Reference</a>
      <img class="carat" src="img/carat.png" />
      LineSDK  Reference
    </p>

    <div class="content-wrapper">
      <nav class="navigation">
        <ul class="nav-groups">
          <li class="nav-group-name">
            <a class="nav-group-name-link" href="Classes.html">Classes</a>
            <ul class="nav-group-tasks">
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Classes/AccessTokenStore.html">AccessTokenStore</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Classes/JSONParsePipeline.html">JSONParsePipeline</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Classes/LoginButton.html">LoginButton</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Classes/LoginButton/ButtonSize.html">– ButtonSize</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Classes/LoginManager.html">LoginManager</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Classes/LoginManager/Parameters.html">– Parameters</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Classes/LoginManager/BotPrompt.html">– BotPrompt</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Classes/LoginManager/WebPageLanguage.html">– WebPageLanguage</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Classes/LoginProcess.html">LoginProcess</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Classes/OpenChatCreatingController.html">OpenChatCreatingController</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Classes/Session.html">Session</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Classes.html#/s:7LineSDK11SessionTaskC">SessionTask</a>
              </li>
            </ul>
          </li>
          <li class="nav-group-name">
            <a class="nav-group-name-link" href="Enums.html">Enumerations</a>
            <ul class="nav-group-tasks">
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Enums/API.html">API</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Enums/API/Auth.html">– Auth</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Enums/AuthenticateMethod.html">AuthenticateMethod</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Enums/AuthorizationStatus.html">AuthorizationStatus</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Enums/CallbackQueue.html">CallbackQueue</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Enums/ContentType.html">ContentType</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Enums/CryptoError.html">CryptoError</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Enums/CryptoError/AlgorithmsErrorReason.html">– AlgorithmsErrorReason</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Enums/CryptoError/JWTErrorReason.html">– JWTErrorReason</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Enums/CryptoError/JWKErrorReason.html">– JWKErrorReason</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Enums/CryptoError/GeneralErrorReason.html">– GeneralErrorReason</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Enums/HTTPMethod.html">HTTPMethod</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Enums/LineSDKError.html">LineSDKError</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Enums/LineSDKError/RequestErrorReason.html">– RequestErrorReason</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Enums/LineSDKError/ResponseErrorReason.html">– ResponseErrorReason</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Enums/LineSDKError/AuthorizeErrorReason.html">– AuthorizeErrorReason</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Enums/LineSDKError/GeneralErrorReason.html">– GeneralErrorReason</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Enums/ResponsePipeline.html">ResponsePipeline</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Enums/ResponsePipelineRedirectorAction.html">ResponsePipelineRedirectorAction</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Enums/ResultUtil.html">ResultUtil</a>
              </li>
            </ul>
          </li>
          <li class="nav-group-name">
            <a class="nav-group-name-link" href="Extensions.html">Extensions</a>
            <ul class="nav-group-tasks">
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Extensions/Notification.html">Notification</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Extensions/Notification/Name.html">– Name</a>
              </li>
            </ul>
          </li>
          <li class="nav-group-name">
            <a class="nav-group-name-link" href="Protocols.html">Protocols</a>
            <ul class="nav-group-tasks">
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Protocols/DefaultEnumCodable.html">DefaultEnumCodable</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Protocols/LoginButtonDelegate.html">LoginButtonDelegate</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Protocols/OpenChatCreatingControllerDelegate.html">OpenChatCreatingControllerDelegate</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Protocols/Request.html">Request</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Protocols/RequestAdapter.html">RequestAdapter</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Protocols/ResponsePipelineRedirector.html">ResponsePipelineRedirector</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Protocols/ResponsePipelineTerminator.html">ResponsePipelineTerminator</a>
              </li>
            </ul>
          </li>
          <li class="nav-group-name">
            <a class="nav-group-name-link" href="Structs.html">Structures</a>
            <ul class="nav-group-tasks">
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Structs/APIError.html">APIError</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Structs/AccessToken.html">AccessToken</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Structs/AccessTokenVerifyResult.html">AccessTokenVerifyResult</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Structs/AnyRequestAdapter.html">AnyRequestAdapter</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Structs/Constant.html">Constant</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Structs/GetBotFriendshipStatusRequest.html">GetBotFriendshipStatusRequest</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Structs/GetBotFriendshipStatusRequest/Response.html">– Response</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Structs.html#/s:7LineSDK21GetUserProfileRequestV">GetUserProfileRequest</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Structs/GetVerifyTokenRequest.html">GetVerifyTokenRequest</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Structs/HexColor.html">HexColor</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Structs/JWT.html">JWT</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Structs/JWT/Payload.html">– Payload</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Structs/LineSDKNotificationKey.html">LineSDKNotificationKey</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Structs/LoginManagerOptions.html">LoginManagerOptions</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Structs/LoginPermission.html">LoginPermission</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Structs/LoginResult.html">LoginResult</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Structs.html#/s:7LineSDK4UnitV">Unit</a>
              </li>
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Structs/UserProfile.html">UserProfile</a>
              </li>
            </ul>
          </li>
          <li class="nav-group-name">
            <a class="nav-group-name-link" href="Typealiases.html">Type Aliases</a>
            <ul class="nav-group-tasks">
              <li class="nav-group-task">
                <a class="nav-group-task-link" href="Typealiases.html#/s:7LineSDK10Parametersa">Parameters</a>
              </li>
            </ul>
          </li>
        </ul>
      </nav>
      <article class="main-content">

        <section class="section">
          <div class="section-content">
            
            <h1 id='line-sdk-v5-10-for-ios-swift' class='heading'>LINE SDK v5.10 for iOS Swift</h1>

<p>Developed in Swift, the LINE SDK for iOS Swift provides a modern way of implementing LINE APIs. The features included in this SDK will help you develop an iOS app with engaging and personalized user experience.</p>

          </div>
        </section>


      </article>
    </div>
    <section class="footer">
      <p>© 2023 <a class="link" href="https://line.me" target="_blank" rel="external noopener">LY Corporation.</a> All rights reserved.</p>
    </section>
  </body>
</div>
</html>
