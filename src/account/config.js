// Server settings. The backend is not deployed yet: when you have it, set API_BASE_URL
// (for example 'https://api.example.com/v1') and nothing else in the app needs to change.
//
// While API_BASE_URL is empty, debug builds use a built-in MOCK server so the screens can be
// tried today (verification code is always 123456). Release builds never use the mock.
export const API_BASE_URL = '';

export const MOCK_CODE = '123456';
export const REQUEST_TIMEOUT_MS = 15000;
export const CODE_LENGTH = 6;
export const RESEND_SECONDS = 45;
export const MIN_AGE = 13;
export const MAX_AGE = 120;
export const GENDERS = ['female', 'male', 'other', 'unspecified'];

export const useMock = () => !API_BASE_URL && typeof __DEV__ !== 'undefined' && __DEV__ === true;
export const serverReady = () => Boolean(API_BASE_URL) || useMock();
