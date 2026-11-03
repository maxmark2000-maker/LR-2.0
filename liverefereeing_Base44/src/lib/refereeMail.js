const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

// Always the public address of the app — never the preview/sandbox origin.
const PUBLISHED_APP_URL = 'https://liverefereeing.base44.app';

export function generatePassword(length = 10) {
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (n) => CHARS[n % CHARS.length]).join('');
}

export function buildCredentialMail({ displayName, username, password }) {
  const loginUrl = `${PUBLISHED_APP_URL}/live`;
  const subject = 'Your LiveRefereeing referee account';
  const body = [
    `Dear ${displayName || 'referee'},`,
    '',
    'A referee account has been created for you for LiveRefereeing.',
    '',
    `Username: ${username}`,
    `Password: ${password}`,
    '',
    `Sign in here: ${loginUrl}`,
    '',
    'Please confirm briefly once you have tried it that you are able to sign in —',
    'via WhatsApp at +49 (0) 170 2273138 or by email to max.mark2000@icloud.com.',
    '',
    'Please keep these credentials confidential and do not share them.',
    '',
    'Best regards',
    'LiveRefereeing',
  ].join('\n');
  return { subject, body, loginUrl };
}