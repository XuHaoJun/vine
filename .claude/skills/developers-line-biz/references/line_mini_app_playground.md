# LINE MINI App Playground

**Source:** https://miniapp.line.me/lineminiapp_playground
**Section:** LINE MINI App

**Description:** An interactive tool for testing and previewing LINE MINI App UI and features.

---

<!DOCTYPE html>
<html>
<head prefix="website: http://ogp.me/ns/website#">
    <meta charset="utf-8">

    <title>LINE MINI App Playground</title>

    <meta property="og:type" content="website" />
    <meta property="og:title" content="LINE MINI App Playground" />
    <meta property="og:url" content="https://miniapp.line.me/lineminiapp_playground" />
    <meta property="og:image" content="https://obs.line-scdn.net/0hHfeXulCeF0lYIQa1d3BoHgp8HCtrQwlCehUDLjheSworQjYfLDsEaiFdLz91RCJ0LyY-bjteOxJ0cDZ_OBI9LjRKAg51QwtsIBU-bXxzAgkzagxFbDso/f256x256" />
    <meta property="og:description" content="リンクを開くにはこちらをタップ" />

    <meta name="viewport" content="width=device-width, user-scalable=no, initial-scale=1, maximum-scale=1, viewport-fit=cover">

<script type="text/javascript">
function buildLiffFullUrl(originalUrl, fullUrl) {
    const hash = location.hash;
    if (hash) {
        const liffState = "";
        const liffStateWithHash = liffState + hash;

        const fullUrlWithHash = new URL(originalUrl);
        fullUrlWithHash.searchParams.append("liff.state", liffStateWithHash)

        const liffReferrer = "";
        if (liffReferrer !== "") {
            fullUrlWithHash.searchParams.append("liff.referrer", liffReferrer)
        }

        const liffSource = "lp_qr";
        if (liffSource !== "") {
            fullUrlWithHash.searchParams.append("liff.source", liffSource)
        }

        return fullUrlWithHash.href;
    } else {
        return fullUrl;
    }
}
</script>

    <script>
        const liffUrlForLINEApp = "line://app/2006593963-DPoAqdzG";
        let liffFullUrlForLINEApp = "line://app/2006593963-DPoAqdzG?liff.source=lp_qr";
        liffFullUrlForLINEApp = buildLiffFullUrl(liffUrlForLINEApp, liffFullUrlForLINEApp)

        const liffEndpointUrl = "https://liff-playground.netlify.app/?mini="
        let liffFullUrlForBrowser = "https://liff-playground.netlify.app/?mini=&liff.source=lp_qr"
        liffFullUrlForBrowser = buildLiffFullUrl(liffEndpointUrl, liffFullUrlForBrowser)

        window.liffInfo = {
            liffId: "2006593963-DPoAqdzG",
            liffIconUrl: "https://obs.line-scdn.net/0hHfeXulCeF0lYIQa1d3BoHgp8HCtrQwlCehUDLjheSworQjYfLDsEaiFdLz91RCJ0LyY-bjteOxJ0cDZ_OBI9LjRKAg51QwtsIBU-bXxzAgkzagxFbDso/f256x256",
            liffAppDescription: "LINE MINI App Playground",
            isMiniGuidePage: false,
            lineAppDownloadUrl: "",
            liffAppUrl: liffFullUrlForLINEApp,
            liffAppUrlForBrowser: liffFullUrlForBrowser,
            buttonDisplay: {
                downloadLINEApp: false,
                openInBrowser: false
            },
            linkDisplay: {
                openInBrowser: false
            },
            logoDisplay: {
                lineMINIApp: false
            },
            verifiedMini: true,
        };
        window.translations = {
            "liff.landingpage.miniApp.description": "Try {0} on the LINE app without installing or logging in to another app.",
            "liff.landingpage.button.download": "Download LINE",
            "liff.landingpage.button.open": "Open in LINE",
            "liff.landingpage.button.openInBrowser": "Open in browser",
            "liff.landingpage.link.openInBrowser": "Open in browser",
            "liff.miniguidepage.button.open": "Open LINE MINI App",
            "liff.landingpage.pc.title": "Open page on your smartphone",
            "liff.landingpage.pc.qrcode.description": "Scan the QR code on the mobile version of LINE.",
            "liff.landingpage.pc.miniApp.description": "You can open {0} without logging in or installing any apps.",
            "liff.verifiedMini": "Verified MINI App",
        };
    </script>

    <noscript>Your browser does not support JavaScript! Please try to use a different browser to access this page.</noscript>

    <script type="module" crossorigin src="https://static.line-scdn.net/liff-jump-page/edge/production/assets/pc-5oJnGQp9.js"></script>
    <link rel="modulepreload" crossorigin href="https://static.line-scdn.net/liff-jump-page/edge/production/assets/index-ETLxhI87.js">
    <link rel="stylesheet" href="https://static.line-scdn.net/liff-jump-page/edge/production/assets/index-Bzy5DsJ8.css">
</head>

<body>
    <!-- empty -->
</body>

</html>
