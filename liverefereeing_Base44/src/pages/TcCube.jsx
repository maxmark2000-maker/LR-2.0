import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { tc, onGateLocked } from '@/lib/cubeClient';
import CubeHero from '@/components/CubeHero';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import RaceAggregation from '@/components/tc/RaceAggregation';
import TcCubeDashboard from '@/components/tc/TcCubeDashboard';
import TcCubeTabHome from '@/components/tc/TcCubeTabHome';
import RefereeScoreBoard from '@/components/tc/RefereeScoreBoard';
import RaceOverview from '@/components/tc/RaceOverview';
import ScheduleOverview from '@/components/tc/ScheduleOverview';
import DecisionRevisionHistory from '@/components/tc/DecisionRevisionHistory';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { exportRacePdf } from '@/lib/racePdf';
import { GENDERS, HERO_IMAGES } from '@/lib/isu';
import { Radio, RefreshCw } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import TcCubeGate, { isTcCubeUnlocked } from '@/components/tc/TcCubeGate';
import MatchModeToggle from '@/components/tc/MatchModeToggle';

export default function TcCube() {
  const [competitions, setCompetitions] = useState([]);
  const [competitionId, setCompetitionId] = useState('');
  const [unlocked, setUnlocked] = useState(() => isTcCubeUnlocked());
  const [gender, setGender] = useState('');
  const [roundType, setRoundType] = useState('');
  const [distance, setDistance] = useState('');
  const [raceId, setRaceId] = useState('');
  const [rounds, setRounds] = useState([]);
  const [races, setRaces] = useState([]);
  const [athletes, setAthletes] = useState([]);
  const [calls, setCalls] = useState([]);
  const [refereeFunctions, setRefereeFunctions] = useState({});
  const [revisions, setRevisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liveMsg, setLiveMsg] = useState('');
  const [liveBusy, setLiveBusy] = useState(false);
  const [flagBusy, setFlagBusy] = useState(false);
  const [tab, setTab] = useState('aggregation');
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [view, setView] = useState('dashboard');
  const [matchMode, setMatchMode] = useState('lenient');
  const [refereeFlags, setRefereeFlags] = useState([]);
  const [referees, setReferees] = useState([]);

  // Nothing is fetched before the gate is unlocked — an ungated call would be
  // rejected by the server with a 401.
  useEffect(() => {
    if (!unlocked) return;
    (async () => {
      setCompetitions(await tc.entities.Competition.list('-created_date'));
      setLoading(false);
    })();
  }, [unlocked]);

  // An expired gate session drops straight back to the unlock screen.
  useEffect(() => onGateLocked('tc', () => setUnlocked(false)), []);

  // `fresh` bypasses the gateway's short cache: Refresh must show the calls
  // referees submitted a moment ago, not the snapshot of the last few seconds.
  const loadCompetition = async (cid, { fresh = false } = {}) => {
    const api = fresh ? tc.freshEntities : tc.entities;
    const [r, rc, a, c, refs, revs, rflags] = await Promise.all([
      api.Round.filter({ competitionId: cid }),
      api.Race.filter({ competitionId: cid }, '-raceNumber', 500),
      api.Athlete.filter({ competitionId: cid }, '-created_date', 500),
      api.Call.filter({ competitionId: cid }, '-timestamp', 500),
      api.Referee.list('-created_date', 200),
      api.DecisionRevision.filter({ competitionId: cid }, '-revisedAt', 200),
      api.RefereeRaceFlag.filter({ competitionId: cid }, '-flaggedAt', 500),
    ]);
    setRounds(r); setRaces(rc); setAthletes(a); setCalls(c);
    setRevisions(revs);
    setRefereeFlags(rflags || []);
    setReferees(refs || []);
    setRefereeFunctions(Object.fromEntries((refs || []).map((ref) => [ref.id, ref.function && ref.function !== 'NONE' ? ref.function : ''])));
    return { rounds: r };
  };

  const toggleFlag = async () => {
    if (!race) return;
    setFlagBusy(true);
    try {
      const next = !race.flagged;
      await tc.entities.Race.update(race.id, { flagged: next });
      setRaces((prev) => prev.map((r) => r.id === race.id ? { ...r, flagged: next } : r));
    } finally {
      setFlagBusy(false);
    }
  };

  useEffect(() => {
    if (!competitionId) return;
    loadCompetition(competitionId);
  }, [competitionId]);

  const loadLive = async () => {
    setLiveBusy(true);
    setLiveMsg('');
    try {
      const live = await tc.entities.LiveRace.list('-setAt', 1);
      const lr = live[0];
      if (!lr) {
        setLiveMsg('No live race has been set yet. Click LIVE on a race in ORGACube.');
        return;
      }
      setCompetitionId(lr.competitionId);
      const { rounds: loadedRounds } = await loadCompetition(lr.competitionId);
      const r = loadedRounds.find((x) => x.id === lr.roundId);
      setGender(r?.genderGroup || '');
      setRoundType(r?.type || '');
      setDistance(r?.distance || '');
      setRaceId(lr.raceId);
      setView('workspace');
    } catch (err) {
      setLiveMsg(err?.message || 'The live race could not be loaded. Please try again in a moment.');
    } finally {
      setLiveBusy(false);
    }
  };

  const refreshAll = async () => {
    setRefreshBusy(true);
    try {
      setCompetitions(await tc.freshEntities.Competition.list('-created_date'));
      if (competitionId) await loadCompetition(competitionId, { fresh: true });
    } finally {
      setRefreshBusy(false);
    }
  };

  const competition = competitions.find((c) => c.id === competitionId);
  const genderRounds = rounds.filter((r) => r.genderGroup === gender).sort((a, b) => a.sequence - b.sequence);
  const roundTypes = Array.from(new Set(genderRounds.map((r) => r.type)));
  const distanceOptions = Array.from(new Set(
    genderRounds.filter((r) => r.type === roundType).map((r) => r.distance).filter(Boolean)
  ));
  const round = roundType && distance
    ? genderRounds.find((r) => r.type === roundType && r.distance === distance) || null
    : null;
  const roundId = round?.id || '';
  const roundRaces = roundId
    ? races.filter((r) => r.roundId === roundId && (r.athleteIds || []).length > 0).sort((a, b) => a.raceNumber - b.raceNumber)
    : [];
  const race = races.find((r) => r.id === raceId);
  const openRaceFromOverview = (r) => {
    const rd = rounds.find((x) => x.id === r.roundId);
    setTab('aggregation');
    setGender(r.genderGroup || '');
    setRoundType(rd?.type || '');
    setDistance(rd?.distance || '');
    setRaceId(r.id);
  };
  const raceIndex = roundRaces.findIndex((r) => r.id === raceId);
  const hasPrevRace = raceIndex > 0;
  const hasNextRace = raceIndex >= 0 && raceIndex < roundRaces.length - 1;

  if (!unlocked) {
    return (
      <div>
        <CubeHero
          image={HERO_IMAGES.main}
          eyebrow="TCCube"
          title="Aggregated calls & race reports"
          subtitle="Review every referee's submissions per competition, gender group, round and race — and export the printable PDF report."
        />
        <TcCubeGate onUnlock={() => setUnlocked(true)} />
      </div>
    );
  }

  if (loading) return <div className="p-16 text-center text-muted-foreground">Loading…</div>;

  return (
    <div>
      <CubeHero
        image={HERO_IMAGES.main}
        eyebrow="TCCube"
        title="Aggregated calls & race reports"
        subtitle="Review every referee's submissions per competition, gender group, round and race — and export the printable PDF report."
      />

      <div className="w-full px-6 lg:px-12 py-12 space-y-8">
        {view === 'dashboard' ? (
          <TcCubeDashboard
            competitions={competitions}
            onOpenCompetition={(cid) => { setCompetitionId(cid); setView('home'); }}
            onLive={loadLive}
            liveBusy={liveBusy}
            liveMsg={liveMsg}
          />
        ) : view === 'home' ? (
          <TcCubeTabHome
            competition={competition}
            onOpenTab={(t) => { setTab(t); setView('workspace'); }}
            onBack={() => setView('dashboard')}
          />
        ) : (
        <>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => setView('home')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to sections
          </Button>
          <MatchModeToggle value={matchMode} onChange={setMatchMode} />
        </div>
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Race overview</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="aggregation">Race Aggregation</TabsTrigger>
            <TabsTrigger value="scores">TC Referee Statistics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardContent className="p-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select
                    value={competitionId}
                    onValueChange={(v) => { setCompetitionId(v); setGender(''); setRoundType(''); setDistance(''); setRaceId(''); }}
                  >
                    <SelectTrigger><SelectValue placeholder="Select a competition" /></SelectTrigger>
                    <SelectContent>
                      {competitions.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">The overview always covers a single competition.</p>
              </CardContent>
            </Card>

            {competitionId ? (
              <RaceOverview
                competition={competition}
                races={races}
                rounds={rounds}
                athletes={athletes}
                calls={calls}
                revisions={revisions}
                refereeFlags={refereeFlags}
                referees={referees}
                onOpenRace={openRaceFromOverview}
                matchMode={matchMode}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Select a competition to see its races.</p>
            )}
          </TabsContent>

          <TabsContent value="schedule" className="space-y-4">
            <ScheduleOverview
              competitionId={competitionId}
              competitions={competitions}
              races={races}
              rounds={rounds}
              onSelectCompetition={(v) => { setCompetitionId(v); setGender(''); setRoundType(''); setDistance(''); setRaceId(''); }}
              onOpenRace={openRaceFromOverview}
            />
          </TabsContent>

          <TabsContent value="aggregation" className="space-y-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Button onClick={loadLive} disabled={liveBusy} className="bg-red-600 hover:bg-red-700">
                      <Radio className="w-4 h-4 mr-2" /> LIVE MODULE
                    </Button>
                    <Button onClick={refreshAll} disabled={refreshBusy} variant="outline">
                      <RefreshCw className={`w-4 h-4 mr-2 ${refreshBusy ? 'animate-spin' : ''}`} /> Refresh
                    </Button>
                    <Button
                      onClick={() => hasPrevRace && setRaceId(roundRaces[raceIndex - 1].id)}
                      disabled={!hasPrevRace}
                      variant="outline"
                    >
                      <ChevronLeft className="w-4 h-4 mr-2" /> Previous race
                    </Button>
                    <Button
                      onClick={() => hasNextRace && setRaceId(roundRaces[raceIndex + 1].id)}
                      disabled={!hasNextRace}
                      variant="outline"
                    >
                      Next race <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                    <span className="text-xs text-muted-foreground">Jump to the race currently pushed live from ORGACube.</span>
                  </div>
                  {liveMsg && <span className="text-xs text-amber-700">{liveMsg}</span>}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <Select value={competitionId} onValueChange={(v) => { setCompetitionId(v); setGender(''); setRoundType(''); setDistance(''); setRaceId(''); }}>
                    <SelectTrigger><SelectValue placeholder="Competition" /></SelectTrigger>
                    <SelectContent>
                      {competitions.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={gender} onValueChange={(v) => { setGender(v); setRoundType(''); setDistance(''); setRaceId(''); }} disabled={!competitionId}>
                    <SelectTrigger><SelectValue placeholder="Gender group" /></SelectTrigger>
                    <SelectContent>
                      {GENDERS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={roundType} onValueChange={(v) => { setRoundType(v); setDistance(''); setRaceId(''); }} disabled={!gender}>
                    <SelectTrigger><SelectValue placeholder="Round" /></SelectTrigger>
                    <SelectContent>
                      {roundTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={distance} onValueChange={(v) => { setDistance(v); setRaceId(''); }} disabled={!roundType}>
                    <SelectTrigger><SelectValue placeholder="Distance" /></SelectTrigger>
                    <SelectContent>
                      {distanceOptions.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={raceId} onValueChange={setRaceId} disabled={!roundId}>
                    <SelectTrigger><SelectValue placeholder="Race" /></SelectTrigger>
                    <SelectContent>
                      {roundRaces.map((r) => <SelectItem key={r.id} value={r.id}>Race {r.raceNumber}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {!raceId && <p className="text-sm text-muted-foreground">Select a competition, gender group, round, distance and race to see the aggregated calls.</p>}

            {raceId && race && (
              <RaceAggregation
                competition={competition}
                round={round}
                race={race}
                athletes={(race.athleteIds || []).map((id) => athletes.find((a) => a.id === id)).filter(Boolean)}
                calls={calls.filter((c) => c.raceId === race.id)}
                refereeFunctions={refereeFunctions}
                onExport={exportRacePdf}
                onRaceUpdated={(id, patch) =>
                  setRaces((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
                }
                onToggleFlag={toggleFlag}
                flagBusy={flagBusy}
                matchMode={matchMode}
                refereeFlags={refereeFlags.filter((f) => f.raceId === race.id)}
                referees={referees}
              />
            )}
          </TabsContent>

          <TabsContent value="scores" className="space-y-8">
            <RefereeScoreBoard
              competition={competition}
              races={races}
              athletes={athletes}
              calls={calls}
              refereeFunctions={refereeFunctions}
              matchMode={matchMode}
            />
            <DecisionRevisionHistory revisions={revisions} athletes={athletes} />
          </TabsContent>

        </Tabs>
        </>
        )}
      </div>
    </div>
  );
}