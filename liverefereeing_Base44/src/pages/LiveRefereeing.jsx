import React, { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import CubeHero from '@/components/CubeHero';
import RefereeLogin from '@/components/live/RefereeLogin';
import CallPad from '@/components/live/CallPad';
import useRefereeSheet from '@/components/live/useRefereeSheet';
import WorkspaceLoadNotice from '@/components/live/WorkspaceLoadNotice';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HERO_IMAGES } from '@/lib/isu';
import { enqueue, flushQueue, readQueue } from '@/lib/callQueue';
import invokeWorkspace from '@/lib/refereeRequest';
import { LogOut, Wifi, WifiOff, Radio } from 'lucide-react';
import FinalDecisionView from '@/components/tc/FinalDecisionView';
import CompetitionBanner from '@/components/live/CompetitionBanner';
import RaceReviewFlag from '@/components/live/RaceReviewFlag';
import MyFlaggedRaces from '@/components/live/MyFlaggedRaces';

const SESSION_KEY = 'liveRefereeingSession';

// The referee functions answer with a 401 when the stored session is no longer
// valid. The SDK turns that into a rejected request, so it has to be caught
// explicitly instead of waiting for an error body that never arrives.
const isExpiredSession = (error) => error?.response?.status === 401 || error?.status === 401;

export default function LiveRefereeing() {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
  });
  const [data, setData] = useState({ competitions: [], rounds: [], races: [], athletes: [], myCalls: [], allowedGenderGroups: [] });
  const [competitionId, setCompetitionId] = useState('');
  const [gender, setGender] = useState('');
  const [roundId, setRoundId] = useState('');
  const [raceId, setRaceId] = useState('');
  const [pending, setPending] = useState(readQueue());
  const [online, setOnline] = useState(navigator.onLine);
  const [submitting, setSubmitting] = useState(false);
  const [liveRace, setLiveRace] = useState(null);
  const [liveBusy, setLiveBusy] = useState(false);
  const [liveMsg, setLiveMsg] = useState('');
  const [sessionNotice, setSessionNotice] = useState('');
  const [flags, setFlags] = useState([]);
  const [flaggedRaces, setFlaggedRaces] = useState([]);
  const [flagBusyRaceId, setFlagBusyRaceId] = useState(null);
  const [tab, setTab] = useState('workspace');
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState('');
  const loadRequest = useRef(0);
  const statusBusy = useRef(false);
  const scope = useRef(null);
  scope.current = { session, competitionId, raceId };

  const liveRaceRef = useRef(null);
  useEffect(() => { liveRaceRef.current = liveRace; }, [liveRace]);
  // The competitions this referee may work in, as last reported by the workspace.
  // A live push into any other competition must not wipe their call sheet.
  const assignedRef = useRef([]);

  // A 401 means the stored referee session is gone: drop it and return the
  // referee to the sign-in card with an explanation.
  const endSession = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setCompetitionId(''); setGender(''); setRoundId(''); setRaceId('');
    setLiveRace(null);
    setSessionNotice('Your referee session has expired. Please sign in again.');
  }, []);

  const { sheet, loading: sheetLoading, error: sheetError, load: loadSheet, setSheet } = useRefereeSheet(session, competitionId, raceId, endSession);

  const load = useCallback(async () => {
    if (!session) return;
    const request = ++loadRequest.current;
    setWorkspaceLoading(true); setWorkspaceError('');
    try {
      const res = await invokeWorkspace({
        refereeId: session.referee.id, token: session.token,
        competitionId: competitionId || undefined,
        mode: competitionId ? 'selection' : 'catalog',
      });
      if (request !== loadRequest.current) return;
      if (res.data?.error) throw new Error(res.data.error);
      // Merge navigation without erasing an independently loaded call sheet.
      setData((prev) => ({ ...prev, ...res.data }));
      assignedRef.current = res.data.assignedCompetitionIds || [];
    } catch (error) {
      if (request !== loadRequest.current) return;
      if (isExpiredSession(error)) endSession();
      else setWorkspaceError(error?.response?.data?.error || error.message || 'The competition could not be loaded.');
    } finally {
      if (request === loadRequest.current) setWorkspaceLoading(false);
    }
  }, [session, competitionId, endSession]);

  const loadStatus = useCallback(async () => {
    if (!session) return;
    try {
      const res = await base44.functions.invoke('refereeWorkspace', {
        refereeId: session.referee.id, token: session.token, competitionId,
        raceId: raceId || '', mode: 'status',
      });
      if (scope.current.session !== session || scope.current.competitionId !== competitionId || scope.current.raceId !== raceId) return;
      assignedRef.current = res.data.assignedCompetitionIds || [];
      const selected = res.data.raceStatus?.find((race) => race.id === raceId);
      if (selected) {
        setData((prev) => ({ ...prev, races: prev.races.map((race) => race.id === selected.id ? { ...race, ...selected } : race) }));
        setSheet((prev) => (prev?.race ? { ...prev, race: { ...prev.race, ...selected } } : prev));
      }
      const lr = res.data.liveRace;
      if (lr && liveRaceRef.current?.raceId !== lr.raceId) applyLive(lr, true);
      else if (!lr && liveRaceRef.current) setLiveRace(null);
      return 60000;
    } catch (error) {
      if (scope.current.session === session && isExpiredSession(error)) endSession();
      const retrySeconds = Number(error?.response?.data?.retryAfterSeconds || error?.response?.headers?.['retry-after'])
        || Number(String(error?.response?.data?.error || '').match(/Retry after (\d+)s/i)?.[1]);
      return retrySeconds > 0 ? retrySeconds * 1000 + 250 : 60000;
    }
  }, [session, competitionId, raceId, setSheet, endSession]);

  useEffect(() => {
    setData((prev) => ({ ...prev, rounds: [], races: [], athletes: [], myCalls: [] }));
    setFlags([]);
    load();
    return () => { loadRequest.current += 1; };
  }, [load]);

  // The referee's own review flags, with race / round / competition labels
  // resolved server-side so this public page never reads entities directly.
  const loadFlaggedRaces = useCallback(async () => {
    if (!session) return;
    try {
      const res = await base44.functions.invoke('refereeWorkspace', {
        refereeId: session.referee.id,
        token: session.token,
        competitionId: competitionId || undefined,
        mode: 'flags',
      });
      if (res.data?.error) return;
      setFlaggedRaces(res.data.myFlags || []);
    } catch (error) {
      if (isExpiredSession(error)) endSession();
    }
  }, [session, competitionId, endSession]);

  // The referee's own review flags are read once per competition and drive both
  // the flag button on the call sheet and the flagged-races tab.
  useEffect(() => { loadFlaggedRaces(); }, [loadFlaggedRaces]);
  useEffect(() => {
    setFlags(flaggedRaces.filter((entry) => entry.competitionId === competitionId)
      .map((entry) => ({ raceId: entry.raceId, videoTimestamp: entry.videoTimestamp })));
  }, [flaggedRaces, competitionId]);

  // Flag / unflag / re-timestamp a race for personal review. This never changes
  // calls, scoring, the Final Decision or the official TC flag.
  const setRaceFlag = async (targetRaceId, payload) => {
    setFlagBusyRaceId(targetRaceId);
    try {
      const res = await base44.functions.invoke('refereeWorkspace', {
        refereeId: session.referee.id,
        token: session.token,
        action: 'setFlag',
        raceId: targetRaceId,
        flagged: payload.flagged !== false,
        videoTimestamp: payload.videoTimestamp,
      });
      if (res.data?.error) return false;
      const flag = res.data?.flag || null;
      setFlags((prev) => (flag
        ? [...prev.filter((f) => f.raceId !== targetRaceId), flag]
        : prev.filter((f) => f.raceId !== targetRaceId)));
      await loadFlaggedRaces();
      return true;
    } catch (error) {
      if (isExpiredSession(error)) endSession();
      return false;
    } finally {
      setFlagBusyRaceId(null);
    }
  };

  const openFlaggedRace = (entry) => {
    setCompetitionId(entry.competitionId);
    setGender(entry.genderGroup || '');
    setRoundId(entry.roundId || '');
    setRaceId(entry.raceId);
    setTab('workspace');
  };

  const applyLive = useCallback((lr, fromPush = false) => {
    if (!lr) return;
    // A pushed race is only applied once the workspace has told us which
    // competitions this referee may work in. Jumping into any other competition
    // used to leave them with an empty call sheet, which looked like the Live
    // module was broken; the next poll applies the push once the list is known.
    if (fromPush) {
      const assigned = assignedRef.current;
      if (!assigned.length) return;
      if (!assigned.includes(lr.competitionId)) {
        setLiveMsg(`Live race ${lr.raceNumber} is in a competition you are not assigned to.`);
        return;
      }
    }
    // Apply immediately — the workspace reload for the live competition validates
    // the referee's assignment and reports a clear message if it isn't assigned.
    setLiveRace(lr);
    setCompetitionId(lr.competitionId);
    setGender(lr.genderGroup);
    setRoundId(lr.roundId);
    setRaceId(lr.raceId);
    setLiveMsg('');
  }, []);

  useEffect(() => {
    if (data.liveRace) applyLive(data.liveRace, true);
  }, [data.liveRace, applyLive]);

  // One in-flight refresh across selection changes. Initial sheet loading takes
  // priority; neither hidden tabs nor the opening render start redundant polls.
  useEffect(() => {
    if (!session || workspaceLoading || sheetLoading || workspaceError || sheetError) return;
    let active = true;
    let timer;
    let nextAllowedAt = 0;
    const tick = async () => {
      clearTimeout(timer);
      if (!active) return;
      if (document.hidden || !navigator.onLine || statusBusy.current || Date.now() < nextAllowedAt) {
        timer = setTimeout(tick, Math.max(15000, nextAllowedAt - Date.now()));
        return;
      }
      statusBusy.current = true;
      let delay = 60000;
      try { delay = await loadStatus() || 60000; } finally { statusBusy.current = false; }
      nextAllowedAt = Date.now() + delay;
      if (active) timer = setTimeout(tick, delay);
    };
    timer = setTimeout(tick, 15000);
    const onVisible = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [session, loadStatus, workspaceLoading, sheetLoading, workspaceError, sheetError]);



  useEffect(() => {
    const goOnline = async () => {
      setOnline(true);
      const result = await flushQueue(session);
      setPending(readQueue());
      if (result.sent > 0) loadSheet();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [session, loadSheet]);

  const login = (s) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    setSessionNotice('');
    setSession(s);
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setCompetitionId(''); setGender(''); setRoundId(''); setRaceId('');
  };

  const loadLive = async () => {
    setLiveBusy(true);
    setLiveMsg('');
    try {
      const res = await base44.functions.invoke('refereeWorkspace', {
        refereeId: session.referee.id,
        token: session.token,
        mode: 'live',
      });
      const lr = res.data?.liveRace;
      if (!lr) {
        setLiveMsg('No live race has been set yet. Set one in ORGACube.');
        return;
      }
      applyLive(lr);
    } catch (error) {
      if (isExpiredSession(error)) endSession();
    } finally {
      setLiveBusy(false);
    }
  };

  const submitCalls = async (calls) => {
    setSubmitting(true);
    const payloads = calls.map((c) => ({ ...c, raceId }));
    payloads.forEach((p) => enqueue(p));
    if (!navigator.onLine) {
      setPending(readQueue());
      setSubmitting(false);
      return { sent: 0, queued: true };
    }
    const queuedItems = readQueue();
    const result = await flushQueue(session);
    const stillQueued = readQueue();
    setPending(stillQueued);
    if (result.error === 'session_expired') {
      endSession();
      setSubmitting(false);
      return result;
    }
    if (result.sent > 0) {
      // Only the calls that actually left the queue count as submitted — a batch
      // that failed mid-way stays queued (and shown as queued) instead of being
      // displayed as an accepted call.
      const queueKey = (c) => `${c.raceId}|${c.athleteId || ''}|${c.mark || ''}`;
      const stillKeys = new Set(stillQueued.map(queueKey));
      const sentItems = queuedItems.filter((q) => !stillKeys.has(queueKey(q)));
      // Optimistically merge the just-sent calls into local state instead of
      // reloading the whole workspace (slow). The next periodic poll reconciles.
      setData((prev) => {
        const remaining = prev.myCalls.filter((c) => !sentItems.some((q) => q.raceId === c.raceId && q.athleteId === c.athleteId && q.mark === c.mark));
        return { ...prev, myCalls: [...remaining, ...sentItems] };
      });
    }
    setSubmitting(false);
    return result;
  };

  if (!session) {
    return (
      <div>
        <CubeHero image={HERO_IMAGES.ice} eyebrow="LiveRefereeing Cube" title="Live referee workspace" subtitle="Sign in with the credentials issued by ORGACube to submit your calls for the races you are assigned to." />
        <div className="w-full px-6 lg:px-12 py-14">
          <RefereeLogin onLogin={login} notice={sessionNotice} />
        </div>
      </div>
    );
  }

  const genders = data.allowedGenderGroups || [];
  const rounds = data.rounds.filter((r) => r.genderGroup === gender).sort((a, b) => a.sequence - b.sequence);
  const races = data.races.filter((r) => r.roundId === roundId).sort((a, b) => a.raceNumber - b.raceNumber);
  const race = sheet?.race;
  const round = sheet?.round || data.rounds.find((r) => r.id === roundId);
  const raceAthletes = race ? (race.athleteIds || []).map((id) => sheet.athletes.find((a) => a.id === id)).filter(Boolean) : [];
  const competition = data.competitions.find((c) => c.id === competitionId);
  const raceCalls = Array.from(new Map([...(sheet?.myCalls || []), ...data.myCalls.filter((c) => c.raceId === raceId)]
    .map((call) => [`${call.athleteId || ''}|${call.mark || ''}`, call])).values());
  const racePending = pending.filter((c) => c.raceId === raceId);
  // Flagged races are listed per competition — otherwise the list grows with every
  // competition the referee has ever worked in.
  const competitionFlags = flaggedRaces.filter((e) => e.competitionId === competitionId);
  // Apprentices never see a debrief revision in the Final sheet.
  const isApprentice = (data.referee?.function || session.referee.function) === 'APPR';

  return (
    <div>
      <CubeHero image={HERO_IMAGES.ice} eyebrow="LiveRefereeing Cube" title={`Referee: ${session.referee.displayName}`} subtitle="Select competition, gender group, round and race, then submit your calls." />

      <div className="w-full px-6 lg:px-12 py-10 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <span className={`inline-flex items-center gap-2 text-sm ${online ? 'text-emerald-700' : 'text-amber-700'}`}>
            {online ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            {online ? 'Connected' : 'Offline — calls are queued locally'}
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={loadLive} disabled={liveBusy} className="bg-red-600 hover:bg-red-700">
              <Radio className="w-4 h-4 mr-2" /> LIVE MODULE
            </Button>
            <Button variant="ghost" size="sm" onClick={logout}><LogOut className="w-4 h-4 mr-1" /> Sign out</Button>
          </div>
        </div>

        {liveMsg && <p className="text-xs text-amber-700">{liveMsg}</p>}

        {liveRace && (
          <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            <Radio className="w-4 h-4 animate-pulse" />
            <span className="font-medium">LIVE</span>
            <span className="text-red-600/80">— ORGACube pushed Race {liveRace.raceNumber} to your workspace.</span>
          </div>
        )}

        <Card>
          <CardContent className="p-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select value={competitionId} onValueChange={(v) => { setCompetitionId(v); setGender(''); setRoundId(''); setRaceId(''); }}>
              <SelectTrigger><SelectValue placeholder="Competition" /></SelectTrigger>
              <SelectContent>
                {data.competitions.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={gender} onValueChange={(v) => { setGender(v); setRoundId(''); setRaceId(''); }} disabled={!competitionId || workspaceLoading}>
              <SelectTrigger><SelectValue placeholder="Gender group" /></SelectTrigger>
              <SelectContent>
                {genders.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={roundId} onValueChange={(v) => { setRoundId(v); setRaceId(''); }} disabled={!gender || workspaceLoading}>
              <SelectTrigger><SelectValue placeholder="Round" /></SelectTrigger>
              <SelectContent>
                {rounds.map((r) => <SelectItem key={r.id} value={r.id}>{r.type} — {r.distance}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={raceId} onValueChange={setRaceId} disabled={!roundId || workspaceLoading}>
              <SelectTrigger><SelectValue placeholder="Race" /></SelectTrigger>
              <SelectContent>
                {races.map((r) => <SelectItem key={r.id} value={r.id}>Race {r.raceNumber}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <WorkspaceLoadNotice loading={workspaceLoading} error={workspaceError} onRetry={load} label="Loading competition…" />

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="workspace">Race workspace</TabsTrigger>
            <TabsTrigger value="flags">My flagged races · {competitionFlags.length}</TabsTrigger>
          </TabsList>

          <TabsContent value="workspace" className="space-y-6">
        {!raceId ? (
          <p className="text-sm text-muted-foreground">Select a race to see the athlete list, the stream and the call pad.</p>
        ) : sheetLoading || sheetError ? (
          <WorkspaceLoadNotice loading={sheetLoading} error={sheetError} onRetry={loadSheet} />
        ) : (
          <div className="space-y-6">
            <CompetitionBanner competition={competition} />

            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="pt-1">
                {(race?.youtubeUrl || competition?.youtubeUrl) && (
                  <a href={race?.youtubeUrl || competition?.youtubeUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary underline underline-offset-2 hover:text-isu-navy">
                    Video stream
                  </a>
                )}
              </div>
              <RaceReviewFlag
                flag={flags.find((f) => f.raceId === raceId) || null}
                busy={flagBusyRaceId === raceId}
                onSet={(payload) => setRaceFlag(raceId, payload)}
              />
            </div>

            <Card className="overflow-hidden border-isu-navy/20 shadow-md">
              <CardContent className="p-0">
                <CallPad
                  key={raceId}
                  athletes={raceAthletes}
                  onSubmit={submitCalls}
                  submitting={submitting}
                  submittedCalls={raceCalls}
                  pending={racePending}
                  locked={!!race?.isClosed}
                  roundType={round?.type}
                  distance={round?.distance}
                  genderGroup={round?.genderGroup}
                  raceNumber={race?.raceNumber}
                  raceId={raceId}
                  markCountries={race?.markCountries}
                />
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-isu-navy/20 shadow-md">
              <CardContent className="p-0">
                <FinalDecisionView race={race} athletes={raceAthletes} myCalls={[...raceCalls, ...racePending]} hideDebrief={isApprentice} />
              </CardContent>
            </Card>

          </div>
        )}
          </TabsContent>

          <TabsContent value="flags" className="space-y-6">
            {competitionId ? (
              <MyFlaggedRaces
                entries={competitionFlags}
                busyRaceId={flagBusyRaceId}
                onOpen={openFlaggedRace}
                onSaveTimestamp={(targetRaceId, videoTimestamp) => setRaceFlag(targetRaceId, { flagged: true, videoTimestamp })}
                onRemove={(targetRaceId) => setRaceFlag(targetRaceId, { flagged: false })}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Select a competition above to see the races you flagged for review.</p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}