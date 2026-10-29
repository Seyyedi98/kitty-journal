window.__bioResult = true;
window.__bioCalls = 0;
export async function hasHardwareAsync() { return true; }
export async function isEnrolledAsync() { return true; }
export async function authenticateAsync() { window.__bioCalls += 1; return { success: window.__bioResult === true }; }
