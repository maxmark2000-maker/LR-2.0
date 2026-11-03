import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { orga } from '@/lib/cubeClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ROUND_TYPES, ROUND_SEQUENCE, distancesFor } from '@/lib/isu';
import RaceAssignment from '@/components/orga/RaceAssignment';
import { Plus, CheckCircle2, Lock } from 'lucide-react';

export default function RoundManager({ competitionId, gender, rounds, races, athletes, canEdit, onChange, distanceFilter = 'ALL', focusRaceId = null }) {
  const [type, setType] = useState(ROUND_TYPES[0]);
  const [distance, setDistance] = useState(distancesFor(gender)[0]);
  const [racesCount, setRacesCount] = useState('2');
  const [error, setError] = useState('');
  const genderRounds = [...rounds].sort((a, b) => a.sequence - b.sequence);
  const visibleRounds = distanceFilter === 'ALL'
    ? genderRounds
    : genderRounds.filter((r) => r.distance === distanceFilter);

  useEffect(() => { setDistance(distancesFor(gender)[0]); }, [gender]);

  const [highlightId, setHighlightId] = useState(null);
  useEffect(() => {
    if (!focusRaceId) return;
    setHighlightId(focusRaceId);
    const t = setTimeout(() => setHighlightId(null), 3500);
    const el = document.getElementById(`race-assign-${focusRaceId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return () => clearTimeout(t);
  }, [focusRaceId]);

  // Each distance is treated as its own competition: progression is scoped to the
  // same distance only, so every distance restarts from the full gender roster.
  const roundsForDistance = (round) =>
    genderRounds.filter((r) => r.distance === round.distance).sort((a, b) => a.sequence - b.sequence);

  const previousComplete = (round) =>
    roundsForDistance(round).filter((r) => r.sequence < round.sequence).every((r) => r.isComplete);

  // Athletes eligible for a round = those who ran in the previous round of the SAME distance.
  // The first round of a distance starts with the full gender roster.
  // Final B and Final A both draw from the Semi Finals of that distance (Final A skips Final B).
  const sourceRoundFor = (round) => {
    const sameDistance = roundsForDistance(round);
    if (['Final B', 'Final'].includes(round.type)) {
      return sameDistance.find((r) => r.type === 'Semi Finals');
    }
    return sameDistance
      .filter((r) => r.sequence < round.sequence)
      .sort((a, b) => b.sequence - a.sequence)[0];
  };

  const advancingAthletesFor = (round) => {
    const prev = sourceRoundFor(round);
    if (!prev) return athletes;
    const prevRaceAthletes = new Set(
      races.filter((r) => r.roundId === prev.id).flatMap((r) => r.athleteIds || [])
    );
    return athletes.filter((a) => prevRaceAthletes.has(a.id));
  };

  const isFirstOfDistance = (round) => roundsForDistance(round)[0]?.id === round.id;

  const createRound = async (e) => {
    e.preventDefault();
    const count = parseInt(racesCount, 10);
    if (!count || count < 1 || count > 20) {
      setError('Number of races must be between 1 and 20.');
      return;
    }
    if (genderRounds.some((r) => r.type === type && r.distance === distance)) {
      setError(`${type} (${distance}) already exists for ${gender}.`);
      return;
    }
    setError('');
    const sequence = ROUND_SEQUENCE[type];
    const round = await orga.entities.Round.create({
      competitionId, genderGroup: gender, type, distance, sequence, racesCount: count, isComplete: false,
    });
    await orga.entities.Race.bulkCreate(
      Array.from({ length: count }, (_, i) => ({
        competitionId, roundId: round.id, genderGroup: gender, raceNumber: i + 1, athleteIds: [],
      }))
    );
    // Auto-generate schedule entries in creation order, one per race, so a manually
    // built round set becomes a usable schedule without uploading a file.
    try {
      const existing = await orga.entities.ScheduleEntry.filter({ competitionId });
      const latest = existing.reduce((mx, e) => {
        const t = e.scheduledTime ? new Date(e.scheduledTime).getTime() : 0;
        return t > mx ? t : mx;
      }, Date.now());
      const stepMs = 5 * 60 * 1000;
      await orga.entities.ScheduleEntry.bulkCreate(
        Array.from({ length: count }, (_, i) => ({
          competitionId,
          scheduledTime: new Date(latest + (i + 1) * stepMs).toISOString(),
          raceNumber: i + 1,
          roundType: round.type,
          distance: round.distance,
          genderGroup: gender,
          label: `${round.type} · ${round.distance} · ${gender}`,
        }))
      );
    } catch {
      // schedule generation is best-effort; round and races are already created
    }
    onChange();
  };

  const markComplete = async (round) => {
    await orga.entities.Round.update(round.id, { isComplete: true });
    await orga.entities.AuditLog.create({
      action: 'ROUND_COMPLETED',
      actorRole: 'ORG_ADMIN',
      details: `${gender} ${round.type} (${round.distance || 'n/a'}) marked complete`,
      timestamp: new Date().toISOString(),
    });
    onChange();
  };

  const reopenRound = async (round) => {
    await orga.entities.Round.update(round.id, { isComplete: false });
    await orga.entities.AuditLog.create({
      action: 'ROUND_REOPENED',
      actorRole: 'ORG_ADMIN',
      details: `${gender} ${round.type} (${round.distance || 'n/a'}) reopened`,
      timestamp: new Date().toISOString(),
    });
    onChange();
  };

  return (
    <div className="space-y-6">
      {canEdit && (
        <Card>
          <CardContent className="p-6">
            <h3 className="font-heading font-bold text-lg">Add {gender} round</h3>
            <form onSubmit={createRound} className="mt-5 grid gap-3 sm:grid-cols-4">
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROUND_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={distance} onValueChange={setDistance}>
                <SelectTrigger><SelectValue placeholder="Distance" /></SelectTrigger>
                <SelectContent>
                  {distancesFor(gender).map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="number" min="1" max="20" value={racesCount} onChange={(e) => setRacesCount(e.target.value)} placeholder="Races in round" />
              <Button type="submit" className="bg-isu-blue hover:bg-isu-navy"><Plus className="w-4 h-4 mr-1" /> Create</Button>
              {error && <p className="text-sm text-destructive sm:col-span-4">{error}</p>}
            </form>
          </CardContent>
        </Card>
      )}

      {genderRounds.length === 0 && (
        <p className="text-sm text-muted-foreground">No {gender.toLowerCase()} rounds configured yet.</p>
      )}

      {visibleRounds.map((round) => {
        const roundRaces = races.filter((r) => r.roundId === round.id).sort((a, b) => a.raceNumber - b.raceNumber);
        const unlocked = previousComplete(round);
        // Assignment stays open: admins can assign athletes in any round at any time.
        // The progression dependency is enforced by the eligible list itself
        // (only athletes who ran in the previous round of the distance appear here),
        // so clicks always persist instead of being silently swallowed by a lock.
        const locked = !canEdit;
        return (
          <Card key={round.id}>
            <CardContent className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="font-heading font-bold text-lg">{round.type}</h3>
                  <Badge variant="outline" className="uppercase text-[10px] tracking-wider">{round.distance || '—'}</Badge>
                  <Badge variant="outline" className="uppercase text-[10px] tracking-wider">{gender}</Badge>
                  {round.isComplete ? (
                    <Badge className="bg-emerald-600 hover:bg-emerald-600"><CheckCircle2 className="w-3 h-3 mr-1" /> Complete</Badge>
                  ) : unlocked ? (
                    <Badge variant="secondary">Open</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-amber-800 bg-amber-100"><Lock className="w-3 h-3 mr-1" /> Awaiting previous round</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {canEdit && !round.isComplete && unlocked && (
                    <Button variant="outline" size="sm" onClick={() => markComplete(round)}>Mark round complete</Button>
                  )}
                  {canEdit && round.isComplete && (
                    <Button variant="outline" size="sm" onClick={() => reopenRound(round)}>Reopen round</Button>
                  )}
                </div>
              </div>

              {!unlocked && !isFirstOfDistance(round) && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Assignments are open, but only athletes who ran in the previous {round.distance || ''} round are listed here — mark the previous round complete once its races are done.
                </p>
              )}

              <p className="mt-3 text-xs text-muted-foreground">
                {isFirstOfDistance(round)
                  ? `Eligible: all ${gender.toLowerCase()} athletes (${athletes.length}).`
                  : ['Final B', 'Final'].includes(round.type)
                    ? `Eligible: athletes from the ${round.distance || ''} Semi Finals (${advancingAthletesFor(round).length}).`
                    : `Eligible: athletes who ran in the previous ${round.distance || ''} round (${advancingAthletesFor(round).length}).`}
              </p>
              <div className="mt-5 space-y-4">
                {roundRaces.map((race) => (
                  <div id={`race-assign-${race.id}`}>
                    <RaceAssignment
                      key={race.id}
                      race={race}
                      athletes={advancingAthletesFor(round)}
                      locked={locked}
                      canEdit={canEdit}
                      onChange={onChange}
                      highlight={highlightId === race.id}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}