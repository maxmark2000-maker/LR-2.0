import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { randomSalt, hashPassword } from '../../shared/refereeAuth.ts';
import { verifyGateToken } from '../../shared/cubeAuth.ts';

export default async function (req) {
  try {
    // ORGACube is protected by its shared password gate (not app-user auth),
    // so no app-user role check here — validation below.
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
    const refereeId = body.refereeId;
    if (!refereeId) return Response.json({ error: 'refereeId is required' }, { status: 400 });

    const referee = await base44.asServiceRole.entities.Referee.get(refereeId);
    if (!referee) return Response.json({ error: 'Referee not found' }, { status: 404 });

    const displayName = body.displayName != null ? String(body.displayName).trim() : referee.displayName;
    const username = body.username != null ? String(body.username).trim().toLowerCase() : referee.username;

    if (!displayName || !username) {
      return Response.json({ error: 'displayName and username are required' }, { status: 400 });
    }

    if (username !== referee.username) {
      const existing = await base44.asServiceRole.entities.Referee.filter({ username });
      if (existing.length > 0 && existing[0].id !== refereeId) {
        return Response.json({ error: 'Username already exists' }, { status: 400 });
      }
    }

    const update = { displayName, username };

    if (body.country != null) {
      update.country = String(body.country).trim().toUpperCase().slice(0, 40);
    }

    if (body.function != null) {
      const allowedFunctions = ['NONE', 'TC', 'APPR'];
      update.function = allowedFunctions.includes(body.function) ? body.function : 'NONE';
    }

    if (body.active != null) update.active = !!body.active;

    if (body.assignedCompetitionIds != null && Array.isArray(body.assignedCompetitionIds)) {
      update.assignedCompetitionIds = body.assignedCompetitionIds.slice(0, 50);
    }

    if (body.password && String(body.password).length > 0) {
      if (String(body.password).length < 6) {
        return Response.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
      }
      const salt = randomSalt();
      update.salt = salt;
      update.passwordHash = await hashPassword(String(body.password), salt);
      update.passwordPlain = String(body.password);
    }

    await base44.asServiceRole.entities.Referee.update(refereeId, update);

    await base44.asServiceRole.entities.AuditLog.create({
      action: 'REFEREE_UPDATED',
      actorName,
      actorRole: 'ORG_ADMIN',
      details: 'Updated referee ' + username,
      timestamp: new Date().toISOString()
    });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}