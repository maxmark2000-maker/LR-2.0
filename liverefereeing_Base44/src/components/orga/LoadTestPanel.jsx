import React, { useEffect, useState } from 'react';
import { orga } from '@/lib/cubeClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Gauge, Loader2 } from 'lucide-react';
import LoadTestReport from '@/components/orga/LoadTestReport';

// Highest number of simulated referees one run may use.
const MAX_SESSIONS = 90;

export default function LoadTestPanel() {
  const [competitions, setCompetitions] = useState([]);
  const [races, setRaces] = useState([]);
  const [competitionId, setCompetitionId] = useState('');
  const [raceId, setRaceId] = useState('');
  const [sessions, setSessions] = useState('30');
  const [mode, setMode] = useState('sheet');
  const [cold, setCold] = useState(true);
  const [spread, setSpread] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);

  useEffect(() => {
    orga.entities.Competition.list()
      .then((list) => setCompetitions(Array.isArray(list) ? list : []))
      .catch((cause) => setError(cause.message || 'Could not load competitions.'));
  }, []);

  useEffect(() => {
    setRaces([]);
    setRaceId('');
    if (!competitionId) return;
    orga.entities.Race.filter({ competitionId })
      .then((list) => setRaces((Array.isArray(list) ? list : []).sort((a, b) => (a.raceNumber || 0) - (b.raceNumber || 0))))
      .catch((cause) => setError(cause.message || 'Could not load the races of this competition.'));
  }, [competitionId]);

  const run = async () => {
    setBusy(true);
    setError('');
    setReport(null);
    try {
      const response = await orga.invoke('loadTest', {
        competitionId, raceId, sessions: Number(sessions) || 30, rounds: 2, cold, mode, spread,
      });
      setReport(response.data);
    } catch (cause) {
      setError(cause.message || 'The load test could not run.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-7 space-y-5">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="lt-competition">Competition</Label>
              <Select value={competitionId} onValueChange={setCompetitionId}>
                <SelectTrigger id="lt-competition" className="mt-2"><SelectValue placeholder="Select competition" /></SelectTrigger>
                <SelectContent>
                  {competitions.map((competition) => (
                    <SelectItem key={competition.id} value={competition.id}>{competition.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="lt-race">Race</Label>
              <Select value={raceId} onValueChange={setRaceId} disabled={!competitionId}>
                <SelectTrigger id="lt-race" className="mt-2"><SelectValue placeholder="Select race" /></SelectTrigger>
                <SelectContent>
                  {races.map((race) => (
                    <SelectItem key={race.id} value={race.id}>
                      Race {race.raceNumber} · {race.genderGroup}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="lt-sessions">Simultaneous referees</Label>
              <Input id="lt-sessions" type="number" min="1" max={MAX_SESSIONS} value={sessions}
                onChange={(e) => setSessions(e.target.value)} className="mt-2" />
              <p className="mt-1 text-xs text-muted-foreground">Runs with at most {MAX_SESSIONS} referees.</p>
            </div>
            <div>
              <Label htmlFor="lt-mode">What is tested</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger id="lt-mode" className="mt-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sheet">Opening a call sheet</SelectItem>
                  <SelectItem value="status">Status refresh while a race runs</SelectItem>
                  <SelectItem value="login">Referee sign-in wave</SelectItem>
                  <SelectItem value="signin">Sign-in, then call sheet at once</SelectItem>
                  </SelectContent>
              </Select>
            </div>
          </div>
          <label className="flex items-start gap-3 text-sm text-muted-foreground">
            <Checkbox checked={cold} onCheckedChange={(value) => setCold(!!value)} className="mt-0.5" />
            <span>Cold start: measures the worst case, when all referees open their sheet at the same moment without cached data.</span>
          </label>
          <label className="flex items-start gap-3 text-sm text-muted-foreground">
            <Checkbox checked={spread} onCheckedChange={(value) => setSpread(!!value)} className="mt-0.5" />
            <span>Different races: spreads the referees over the races of the competition, the hardest case for the shared read budget.</span>
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={run} disabled={busy || !competitionId || (mode !== 'login' && !raceId)} className="bg-isu-blue hover:bg-isu-navy">
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Gauge className="w-4 h-4 mr-2" />}
            {busy ? 'Running test…' : 'Run load test'}
          </Button>
          <p className="text-xs text-muted-foreground">
            The test uses the same read budget as the live referees, so run it outside a running session.
          </p>
        </CardContent>
      </Card>
      <LoadTestReport report={report} />
    </div>
  );
}