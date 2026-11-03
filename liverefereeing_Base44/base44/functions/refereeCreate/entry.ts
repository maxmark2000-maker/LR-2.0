import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { randomSalt, hashPassword } from '../../shared/refereeAuth.ts';
import { verifyGateToken } from '../../shared/cubeAuth.ts';

export default async function (req) {
  try {
    // ORGACube is protected by its shared password gate (not app-user auth),
    // so no app-user role check here — validation + duplicate check below.
    const base44 = createClientFromRequest(req);
    let actorName = 'ORGACube';
    try {
      const user = await base44.auth.me();
      if (user) actorName = user.full_name || user.email;
    } catch { /* anonymous ORGACube session */ }

    const body = await req.json();
    if (!(await verifyGateToken('orga', String(body?.token || '')))) {
      return Response.json({ error: 'ORGACube session expired. Please unlock again.' }, { status: 401 });
    }
    const displayName = (body.displayName || '').trim();
    const username = (body.username || '').trim().toLowerCase();
    const country = (body.country || '').trim().toUpperCase().slice(0, 40);
    const password = body.password || '';
    const assignedCompetitionIds = Array.isArray(body.assignedCompetitionIds) ? body.assignedCompetitionIds.slice(0, 50) : [];
    const allowedGenders = ['MEN', 'WOMEN', 'MIXED'];
    const assignedGenderGroups = Array.isArray(body.assignedGenderGroups)
      ? body.assignedGenderGroups.filter((g) => allowedGenders.includes(g)).slice(0, 3)
      : ['MEN', 'WOMEN', 'MIXED'];
    const allowedFunctions = ['NONE', 'TC', 'APPR'];
    const func = allowedFunctions.includes(body.function) ? body.function : 'NONE';

    if (!displayName || !username || password.length < 6) {
      return Response.json({ error: 'displayName, username and a password of at least 6 characters are required' }, { status: 400 });
    }
    if (!country) {
      return Response.json({ error: 'A country of origin is required' }, { status: 400 });
    }

    const existing = await base44.asServiceRole.entities.Referee.filter({ username });
    if (existing.length > 0) return Response.json({ error: 'Username already exists' }, { status: 400 });

    const salt = randomSalt();
    const passwordHash = await hashPassword(password, salt);
    const referee = await base44.asServiceRole.entities.Referee.create({
      displayName, username, country, salt, passwordHash, passwordPlain: password, assignedCompetitionIds, assignedGenderGroups, function: func, active: true
    });

    await base44.asServiceRole.entities.AuditLog.create({
      action: 'REFEREE_CREATED',
      actorName,
      actorRole: 'ORG_ADMIN',
      details: 'Created referee ' + username,
      timestamp: new Date().toISOString()
    });

    return Response.json({ referee: { id: referee.id, displayName, username } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}