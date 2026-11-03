import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { hashPassword, makeToken, readRefereeList } from '../../shared/refereeAuth.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const username = (body.username || '').trim().toLowerCase();
    const password = body.password || '';
    // Rejected credentials are answered with a 200 and an `error` field on
    // purpose. The sign-in card reads the message from the body, but a non-2xx
    // answer to a function call leaves it stuck on "Signing in…" in the browser
    // (the success path always resolves, so the failure path now takes the same
    // route). The message is what tells the referee what went wrong.
    if (!username || !password) return Response.json({ error: 'Username and password are required' });

    const referees = await readRefereeList(base44);
    const referee = referees.find((entry) => entry.username === username);
    if (!referee || referee.active === false) return Response.json({ error: 'Invalid credentials' });

    const hash = await hashPassword(password, referee.salt);
    if (hash !== referee.passwordHash) return Response.json({ error: 'Invalid credentials' });

    const token = await makeToken(referee);
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'REFEREE_LOGIN',
      actorName: referee.displayName,
      actorRole: 'REFEREE',
      details: 'Referee logged in to LiveRefereeing Cube',
      timestamp: new Date().toISOString()
    });

    return Response.json({
      token,
      referee: {
        id: referee.id,
        displayName: referee.displayName,
        username: referee.username,
        function: referee.function || 'NONE',
        assignedCompetitionIds: referee.assignedCompetitionIds || [],
        assignedGenderGroups: referee.assignedGenderGroups || ['MEN', 'WOMEN']
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}