// LiveRefereeing 2.0 – Referee password email template (TEST clone only).
// Do not email passwords; share them separately via an approved secure channel.
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

export function generatePassword(length = 6) {
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (n) => CHARS[n % CHARS.length]).join('');
}

export function buildCredentialMail({ displayName, username }) {
  const subject = 'Your LiveRefereeing referee account';
  const body = [
    `Dear ${displayName || 'referee'},`,
    '',
    'A referee account has been created for you for LiveRefereeing.',
    '',
    `Username: ${username}`,
    'Your password will be shared separately through a secure channel.',
    '',
    'The event administrator will also share the correct login link with you.',
    '',
    'Please confirm briefly once you have tried signing in that everything works.',
    '',
    'Please keep your credentials confidential and do not share them.',
    '',
    'Best regards',
    'LiveRefereeing',
  ].join('\n');

  // A test clone must never silently send users to the original live app.
  // The URL will be configured explicitly when we prepare the live deployment.
  return { subject, body, loginUrl: '' };
}