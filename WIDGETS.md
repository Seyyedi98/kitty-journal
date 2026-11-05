# ویجت‌های صفحهٔ اصلی (اندروید)

سه ویجت: **Kitty Today** (۲×۲: روز هفته، شمارهٔ بزرگ روز، ماه و سال)، **Kitty Week** (۴×۲: امروز + نوار هفتهٔ جاری) و **Kitty Calendar** (۴×۴: تقویم ماه با امروز برجسته).
زبان، تقویم (شمسی/میلادی)، شروع هفته (دوشنبه / شنبه برای فارسی) و تم برنامه را دنبال می‌کنند. با لمس ویجت برنامه باز می‌شود.

## نصب
1. `npx expo install react-native-android-widget`
2. در `app.json` داخل `plugins`:

       ["react-native-android-widget", {
         "widgets": [
           { "name": "KittyToday", "label": "Kitty Today", "description": "Today's date",
             "minWidth": "110dp", "minHeight": "110dp", "targetCellWidth": 2, "targetCellHeight": 2,
             "updatePeriodMillis": 1800000 },
           { "name": "KittyWeek", "label": "Kitty Week", "description": "Today and this week",
             "minWidth": "250dp", "minHeight": "110dp", "targetCellWidth": 4, "targetCellHeight": 2,
             "updatePeriodMillis": 1800000 },
           { "name": "KittyMonth", "label": "Kitty Calendar", "description": "This month",
             "minWidth": "250dp", "minHeight": "250dp", "targetCellWidth": 4, "targetCellHeight": 4,
             "updatePeriodMillis": 1800000 }
         ]
       }]

3. در فایل ورودی برنامه (`index.js`) **بالای** `registerRootComponent`:

       import { registerWidgetTaskHandler } from 'react-native-android-widget';
       import { widgetTaskHandler } from './src/widgets/widgetTask';
       registerWidgetTaskHandler(widgetTaskHandler);

4. Build جدید (Development Build یا `npx expo prebuild` + run). در Expo Go کار نمی‌کند.
5. روی صفحهٔ اصلی گوشی: لمس طولانی ← Widgets ← Kitty Journal.

## نکته
اندروید حداقل هر ۳۰ دقیقه ویجت را به‌روز می‌کند؛ بعد از نیمه‌شب تاریخ ممکن است تا ۳۰ دقیقه کهنه بماند. با باز کردن برنامه یا تغییر زبان/تم/تقویم بلافاصله به‌روز می‌شود.
