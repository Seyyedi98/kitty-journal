// Android home-screen widgets (react-native-android-widget). Only simple layout
// primitives are allowed here; they are drawn natively, not by React Native.
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { monthData, todayData, weekData } from './widgetData';

/** @param {{ now?: Date, language: string, calendar: string, c: object }} p */
export function TodayWidget({ now, language, calendar, c }) {
  const d = todayData({ now, language, calendar });
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: c.card, borderRadius: 24, padding: 10, flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
    >
      <FlexWidget style={{ width: 'match_parent', backgroundColor: c.accent, borderRadius: 14, paddingVertical: 4, alignItems: 'center', justifyContent: 'center' }}>
        <TextWidget text={d.weekday} style={{ fontSize: 13, fontWeight: '700', color: c.onAccent }} />
      </FlexWidget>
      <TextWidget text={d.day} style={{ fontSize: 44, fontWeight: '800', color: c.ink, marginTop: 10, marginBottom: 4 }} />
      <TextWidget text={`${d.month} ${d.year}`} style={{ fontSize: 12, color: c.muted }} />
    </FlexWidget>
  );
}

export function MonthWidget({ now, language, calendar, c }) {
  const d = monthData({ now, language, calendar });
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: c.card, borderRadius: 24, padding: 12, flexDirection: 'column' }}
    >
      <TextWidget text={d.title} style={{ fontSize: 15, fontWeight: '700', color: c.ink }} />
      <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', marginTop: 6 }}>
        {d.weekdays.map((w, i) => (
          <FlexWidget key={i} style={{ flex: 1, alignItems: 'center' }}>
            <TextWidget text={w} style={{ fontSize: 10, fontWeight: '700', color: c.muted }} />
          </FlexWidget>
        ))}
      </FlexWidget>
      {d.weeks.map((week, r) => (
        <FlexWidget key={r} style={{ flexDirection: 'row', width: 'match_parent', flex: 1 }}>
          {week.map((cell, i) => (
            <FlexWidget key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              {cell.blank ? null : cell.today ? (
                <FlexWidget style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
                  <TextWidget text={cell.label} style={{ fontSize: 12, fontWeight: '800', color: c.onAccent }} />
                </FlexWidget>
              ) : (
                <TextWidget text={cell.label} style={{ fontSize: 12, color: c.ink }} />
              )}
            </FlexWidget>
          ))}
        </FlexWidget>
      ))}
    </FlexWidget>
  );
}

/** 4x2: today on the left, this week as a strip on the right. */
export function WeekWidget({ now, language, calendar, c }) {
  const d = todayData({ now, language, calendar });
  const w = weekData({ now, language, calendar });
  const today = (
    <FlexWidget style={{ width: 104, height: 'match_parent', backgroundColor: c.accent, borderRadius: 18, padding: 6, alignItems: 'center', justifyContent: 'center' }}>
      <TextWidget text={d.weekday} style={{ fontSize: 12, fontWeight: '700', color: c.onAccent }} />
      <TextWidget text={d.day} style={{ fontSize: 38, fontWeight: '800', color: c.onAccent, marginTop: 4, marginBottom: 2 }} />
      <TextWidget text={d.month} style={{ fontSize: 11, color: c.onAccent }} />
    </FlexWidget>
  );
  const strip = (
    <FlexWidget style={{ flex: 1, height: 'match_parent', flexDirection: 'column', justifyContent: 'center', paddingHorizontal: 8 }}>
      <TextWidget text={`${d.month} ${d.year}`} style={{ fontSize: 13, fontWeight: '700', color: c.ink, marginBottom: 8 }} />
      <FlexWidget style={{ flexDirection: 'row', width: 'match_parent' }}>
        {w.days.map((x, i) => (
          <FlexWidget key={i} style={{ flex: 1, alignItems: 'center' }}>
            <TextWidget text={x.wd} style={{ fontSize: 10, fontWeight: '700', color: c.muted, marginBottom: 6 }} />
            {x.today ? (
              <FlexWidget style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
                <TextWidget text={x.label} style={{ fontSize: 13, fontWeight: '800', color: c.onAccent }} />
              </FlexWidget>
            ) : (
              <FlexWidget style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
                <TextWidget text={x.label} style={{ fontSize: 13, color: c.ink }} />
              </FlexWidget>
            )}
          </FlexWidget>
        ))}
      </FlexWidget>
    </FlexWidget>
  );
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: c.card, borderRadius: 24, padding: 8, flexDirection: d.rtl ? 'row-reverse' : 'row', alignItems: 'center' }}
    >
      {today}
      {strip}
    </FlexWidget>
  );
}

export const WIDGET_NAMES = { today: 'KittyToday', week: 'KittyWeek', month: 'KittyMonth' };

/** Widget element for a widget name, painted with the app's current theme. */
export function widgetFor(name, props) {
  if (name === WIDGET_NAMES.month) return <MonthWidget {...props} />;
  if (name === WIDGET_NAMES.week) return <WeekWidget {...props} />;
  return <TodayWidget {...props} />;
}
