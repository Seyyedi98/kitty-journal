// App entry. The home-screen widget task must be registered here: Android starts the app's JS
// in the background to draw a widget, and only this file runs in that case (App.js does not).
import { registerRootComponent } from 'expo';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import App from './App';
import { widgetTaskHandler } from './src/widgets/widgetTask';

registerWidgetTaskHandler(widgetTaskHandler);
registerRootComponent(App);
