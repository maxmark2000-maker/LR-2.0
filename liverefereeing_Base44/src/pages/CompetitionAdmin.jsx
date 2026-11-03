import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { onGateLocked } from '@/lib/cubeClient';
import OrgaCubeGate, { isOrgaCubeUnlocked } from '@/components/orga/OrgaCubeGate';
import useCompetitionData from '@/components/orga/useCompetitionData';
import CubeHero from '@/components/CubeHero';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { HERO_IMAGES, GENDERS } from '@/lib/isu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AthleteManager from '@/components/orga/AthleteManager';
import AthleteImportMixed from '@/components/orga/AthleteImportMixed';
import RoundManager from '@/components/orga/RoundManager';
import RefereeManager from '@/components/orga/RefereeManager';
import RefereeStatistics from '@/components/orga/RefereeStatistics';
import ScheduleManager from '@/components/orga/ScheduleManager';
import { ArrowLeft } from 'lucide-react';

export default function CompetitionAdmin() {
  const { id } = useParams();
  const [unlocked, setUnlocked] = useState(() => isOrgaCubeUnlocked());
  const [gender, setGender] = useState('MEN');
  const [distanceFilter, setDistanceFilter] = useState('ALL');
  const [tab, setTab] = useState('athletes');
  const [focusRaceId, setFocusRaceId] = useState(null);
  const { competition, athletes, rounds, races, loading, error, load, retry } = useCompetitionData(
    id, unlocked, tab === 'rounds' || tab === 'schedule'
  );

  const openRaceFromSchedule = (race) => {
    if (race?.genderGroup) setGender(race.genderGroup);
    setDistanceFilter('ALL');
    setFocusRaceId(race?.id || null);
    setTab('rounds');
  };

  useEffect(() => onGateLocked('orga', () => setUnlocked(false)), []);

  useEffect(() => {
    if (loading || error || !unlocked || competition) return;
    const meta = document.createElement('meta');
    meta.name = 'prerender-status-code';
    meta.content = '404';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, [loading, error, unlocked, competition]);

  const canEdit = true;

  if (!unlocked) return <OrgaCubeGate onUnlock={() => setUnlocked(true)} />;
  if (loading) return <div className="p-16 text-center text-muted-foreground">Loading competition…</div>;
  if (error) return (
    <div className="p-16 text-center">
      <p className="text-muted-foreground">{error}</p>
      <div className="mt-4 flex justify-center gap-3">
        <Button variant="outline" asChild><Link to="/orgacube">All competitions</Link></Button>
        <Button onClick={retry}>Try again</Button>
      </div>
    </div>
  );
  if (!competition) return <div className="p-16 text-center text-muted-foreground">Competition not found.</div>;

  const genderAthletes = athletes.filter((a) => a.genderGroup === gender);
  const genderRounds = rounds.filter((r) => r.genderGroup === gender);
  const availableDistances = Array.from(new Set(genderRounds.map((r) => r.distance).filter(Boolean)));
  const effectiveDistance = distanceFilter !== 'ALL' && !availableDistances.includes(distanceFilter) ? 'ALL' : distanceFilter;

  return (
    <div>
      <CubeHero
        image={HERO_IMAGES.ice}
        eyebrow="ORGACube · Competition administration"
        title={competition.name}
        subtitle={[competition.location, competition.startDate].filter(Boolean).join(' · ') || 'Configure athletes, rounds, races and referee access.'}
      />

      <div className="w-full px-6 lg:px-12 py-12">
        <Button asChild variant="ghost" size="sm" className="mb-6 -ml-3">
          <Link to="/orgacube"><ArrowLeft className="w-4 h-4 mr-1" /> All competitions</Link>
        </Button>

        <div className="flex gap-2 mb-8">
          {GENDERS.map((g) => (
            <button
              key={g}
              onClick={() => setGender(g)}
              className={`px-5 py-2.5 rounded text-sm font-semibold tracking-wide transition-colors ${
                gender === g ? 'bg-isu-navy text-white' : 'bg-secondary text-secondary-foreground hover:bg-accent'
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="athletes">Athletes</TabsTrigger>
            <TabsTrigger value="rounds">Rounds & races</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="referees">Referees</TabsTrigger>
            <TabsTrigger value="statistics">Statistics</TabsTrigger>
          </TabsList>

          <TabsContent value="athletes" className="mt-6">
            {canEdit && (
              <AthleteImportMixed
                competitionId={id}
                existingByGender={{
                  MEN: athletes.filter((a) => a.genderGroup === 'MEN').map((a) => a.helmetNumber),
                  WOMEN: athletes.filter((a) => a.genderGroup === 'WOMEN').map((a) => a.helmetNumber),
                }}
                onDone={load}
              />
            )}
            <AthleteManager competitionId={id} gender={gender} athletes={genderAthletes} canEdit={canEdit} onChange={load} />
          </TabsContent>

          <TabsContent value="rounds" className="mt-6">
            {availableDistances.length > 1 && (
              <div className="flex items-center gap-3 mb-5">
                <span className="text-sm font-semibold text-muted-foreground">Distance</span>
                <Select value={effectiveDistance} onValueChange={setDistanceFilter}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All distances</SelectItem>
                    {availableDistances.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <RoundManager
              competitionId={id}
              gender={gender}
              rounds={genderRounds}
              races={races}
              athletes={genderAthletes}
              canEdit={canEdit}
              onChange={load}
              distanceFilter={effectiveDistance}
              focusRaceId={focusRaceId}
            />
          </TabsContent>

          <TabsContent value="schedule" className="mt-6">
            <ScheduleManager competitionId={id} races={races} rounds={rounds} onChange={load} onOpenRace={openRaceFromSchedule} />
          </TabsContent>

          <TabsContent value="referees" className="mt-6">
            <RefereeManager competitionId={id} canEdit={canEdit} />
          </TabsContent>

          <TabsContent value="statistics" className="mt-6">
            <RefereeStatistics competitionId={id} competition={competition} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}