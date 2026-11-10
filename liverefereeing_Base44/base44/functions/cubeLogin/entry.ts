
import { verifyGatePassword, makeGateToken, isGate } from '../../shared/cubeAuth.ts';

// Server-side password verification for ORGACube and TCCube.
// Passwords and password hashes are never returned to the browser.
export default async function (req) {
  try {
    const body = await req.json();
    const gate = String(body?.gate || '');

    if (!isGate(gate)) {
      return Response.json(
        { error: 'Unknown gate' },
        { status: 400 }
      );
    }

    const ok = await verifyGatePassword(
      gate,
      String(body?.password || '')
    );

    if (!ok) {
      return Response.json({
        error: 'Incorrect password. Please try again.'
      });
    }

    return Response.json({
      token: await makeGateToken(gate)
    });

  } catch (error) {
    console.error('cubeLogin failed:', error);

    return Response.json({
      error: 'Login temporarily unavailable. Please contact the event administrator.'
    });
  }
}
