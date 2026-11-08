# App icon setup

Files in this zip:
- assets/icon.png            1024x1024, the main app icon (transparent corners)
- assets/adaptive-icon.png   Android adaptive icon (artwork at 70% on a warm cream background, so launchers can crop it)
- assets/favicon.png         small version
- assets/images/logo.png     shown in the app's top bar (App.js now uses it)

In app.json, under "expo", make sure these match (change the paths if yours differ):

  "icon": "./assets/icon.png",
  "android": {
    "adaptiveIcon": {
      "foregroundImage": "./assets/adaptive-icon.png",
      "backgroundColor": "#F7E3BC"
    }
  }

The launcher icon is built into the app, so after changing it you must make a new build
(npx expo prebuild --clean if you use a local build, or eas build). Reloading Metro is not enough.
