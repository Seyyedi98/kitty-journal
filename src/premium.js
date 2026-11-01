// Free vs Premium. For now the plan is a setting (so it can be tested with a toggle in Settings);
// a real purchase flow only needs to call the same setPremium().
import React from 'react';

export const FREE_THEME = 'sage';

/** Every gated feature; each has a `premium_<key>` sentence in the translations. */
export const PREMIUM_FEATURES = ['themes', 'fonts', 'pdf', 'lock', 'memories', 'insights'];

/** The theme actually painted: free users always get the default one (their choice is kept for later). */
export const effectiveTheme = (theme, premium) => (premium ? theme : FREE_THEME);

export const PremiumContext = React.createContext({
  premium: false,
  /** Tell the user a feature needs Premium (popup). */
  request: () => {},
  /** Go to the Premium page in Settings. */
  openPremium: () => {},
});

export const usePremium = () => React.useContext(PremiumContext);
