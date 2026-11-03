import { verifyGatePassword, makeGateToken, isGate } from '../../shared/cubeAuth.ts';

// Verifies an ORGACube / TCCube gate password on the server and hands back a
// session token. The password itself never travels to the browser.
export default async function (req) {
  try {
    const body = await req.json();
    const gate = String(body?.gate || '');
    if (!isGate(gate)) return Response.json({ error: 'Unknown gate' }, { status: 400 });

    // Answered with a 200 on purpose, like refereeLogin: the gate screen reads
    // the message from the body, and a non-2xx answer to a function call can
    // leave a sign-in form waiting forever in the browser.
    const ok = await verifyGatePassword(gate, String(body?.password || ''));
    if (!ok) return Response.json({ error: 'Incorrect password. Please try again.' });

    return Response.json({ token: await makeGateToken(gate) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}