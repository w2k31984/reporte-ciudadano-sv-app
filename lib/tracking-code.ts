const trackingAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const trackingCodePattern = new RegExp(
  `^SV-[${trackingAlphabet}]{6}$`,
);

export function normalizeTrackingCode(value: string) {
  return value.trim().toUpperCase();
}

export function isTrackingCode(value: string) {
  return trackingCodePattern.test(normalizeTrackingCode(value));
}
