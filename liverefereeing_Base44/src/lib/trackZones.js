// Physical track zones from the Short Track guidance. The zone is metadata of the
// MARK, not of the decision: it is derived from the call code once and kept even
// when the referee later changes the decision to a code that carries no location.

export const TRACK_ZONES = ['Start', 'Straight', 'End of Straight', 'Corner', 'Finish'];

// Start: ST1–ST6 · Straight: S1–S5 · End of Straight: S6–S9 · Corner: C1–C5 · Finish: F1–F6.
// Relay and other codes (SR, NRV, ADV, OFF, ASS, EQP, EMB, R1–R7 …) carry no
// physical zone of their own, so they never move a MARK on the track.
export function trackZoneFromCode(code) {
  const c = String(code || '').trim().toUpperCase();
  if (/^ST[1-6]$/.test(c)) return 'Start';
  if (/^S[1-5]$/.test(c)) return 'Straight';
  if (/^S[6-9]$/.test(c)) return 'End of Straight';
  if (/^C[1-5]$/.test(c)) return 'Corner';
  if (/^F[1-6]$/.test(c)) return 'Finish';
  return null;
}