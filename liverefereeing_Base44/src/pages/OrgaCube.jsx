import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { orga, onGateLocked } from '@/lib/cubeClient';
import CubeHero from '@/components/CubeHero';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HERO_IMAGES } from '@/lib/isu';
import { ArrowRight, Gauge, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import RefereeAdmin from '@/components/orga/RefereeAdmin';
import OrgaCubeGate, { isOrgaCubeUnlocked } from '@/components/orga/OrgaCubeGate';

export default function OrgaCube() {
  const [user, setUser] = useState(null);
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [unlocked, setUnlocked] = useState(() => isOrgaCubeUnlocked());
  const [form, setForm] = useState({ name: '', location: '', startDate: '', youtubeUrl: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    const list = await orga.entities.Competition.list('-created_date');
    setCompetitions(list);
  };

  useEffect(() => {
    (async () => {
      try { setUser(await base44.auth.me()); } catch { setUser(null); }
    })();
  }, []);

  // Nothing is fetched before the gate is unlocked — an ungated call would be
  // rejected by the server with a 401.
  useEffect(() => {
    if (!unlocked) return;
    (async () => {
      try {
        await load();
        setLoadError('');
      } catch (e) {
        setLoadError(e?.message || 'Could not load competitions.');
      } finally {
        setLoading(false);
      }
    })();
  }, [unlocked]);

  const retryLoad = async () => {
    setLoading(true);
    try {
      await load();
      setLoadError('');
    } catch (e) {
      setLoadError(e?.message || 'Could not load competitions.');
    } finally {
      setLoading(false);
    }
  };

  // An expired gate session drops straight back to the unlock screen.
  useEffect(() => onGateLocked('orga', () => setUnlocked(false)), []);

  const isAdmin = true;

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Competition name is required.');
      return;
    }
    setError('');
    setSaving(true);
    const created = await orga.entities.Competition.create({ ...form, status: 'active' });
    await orga.entities.AuditLog.create({
      action: 'COMPETITION_CREATED',
      actorName: user?.full_name || user?.email,
      actorRole: 'ORG_ADMIN',
      details: 'Created competition ' + created.name,
      timestamp: new Date().toISOString(),
    });
    setForm({ name: '', location: '', startDate: '', youtubeUrl: '' });
    await load();
    setSaving(false);
  };

  const handleDelete = async () => {
    const c = deleteTarget;
    if (!c) return;
    setDeleting(true);
    try {
      await orga.entities.Call.deleteMany({ competitionId: c.id });
      await orga.entities.Race.deleteMany({ competitionId: c.id });
      await orga.entities.Round.deleteMany({ competitionId: c.id });
      await orga.entities.Athlete.deleteMany({ competitionId: c.id });
      await orga.entities.Competition.delete(c.id);
      await orga.entities.AuditLog.create({
        action: 'COMPETITION_DELETED',
        actorName: user?.full_name || user?.email,
        actorRole: 'ORG_ADMIN',
        details: 'Deleted competition ' + c.name,
        timestamp: new Date().toISOString(),
      });
      setDeleteTarget(null);
      await load();
    } finally {
      setDeleting(false);
    }
  };

  if (!unlocked) {
    return (
      <div>
        <CubeHero
          eyebrow="ORGACube"
          title="Organisation & administration"
          subtitle="Create competitions, register MEN and WOMEN athletes, configure every round type per gender, assign races and issue referee credentials."
        />
        <OrgaCubeGate onUnlock={() => setUnlocked(true)} />
      </div>
    );
  }

  return (
    <div>
      <CubeHero
        eyebrow="ORGACube"
        title="Organisation & administration"
        subtitle="Create competitions, register MEN and WOMEN athletes, configure every round type per gender, assign races and issue referee credentials."
      />

      <div className="w-full px-6 lg:px-12 py-14 space-y-12">
        <div className="flex justify-end">
          <Link to="/orgacube/load-test" className="inline-flex items-center gap-2 text-sm font-semibold text-isu-blue hover:text-isu-navy">
            <Gauge className="w-4 h-4" /> Load test for live sessions
          </Link>
        </div>
        {!isAdmin && (
          <div className="flex gap-3 items-start rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <p>Your account does not have the ORG_ADMIN role. You can review data, but creating competitions, athletes, rounds and referee credentials requires ORG_ADMIN.</p>
          </div>
        )}

        <Tabs defaultValue="competitions">
          <TabsList>
            <TabsTrigger value="competitions">Competitions</TabsTrigger>
            <TabsTrigger value="referees">Referee accounts</TabsTrigger>
          </TabsList>

          <TabsContent value="competitions" className="space-y-12 mt-8">
        {isAdmin && (
          <Card>
            <CardContent className="p-7">
              <h2 className="font-heading text-xl font-bold">New competition</h2>
              <form onSubmit={submit} className="mt-6 grid gap-5 md:grid-cols-2">
                <div>
                  <Label htmlFor="name">Competition name *</Label>
                  <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ISU World Cup Short Track" className="mt-2" />
                </div>
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input id="location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Dresden, GER" className="mt-2" />
                </div>
                <div>
                  <Label htmlFor="startDate">Start date</Label>
                  <Input id="startDate" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="mt-2" />
                </div>
                <div>
                  <Label htmlFor="youtubeUrl">Default YouTube stream URL</Label>
                  <Input id="youtubeUrl" value={form.youtubeUrl} onChange={(e) => setForm({ ...form, youtubeUrl: e.target.value })} placeholder="https://youtube.com/watch?v=..." className="mt-2" />
                </div>
                {error && <p className="text-sm text-destructive md:col-span-2">{error}</p>}
                <div className="md:col-span-2">
                  <Button type="submit" disabled={saving} className="bg-isu-blue hover:bg-isu-navy">
                    <Plus className="w-4 h-4 mr-2" /> {saving ? 'Creating…' : 'Create competition'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div>
          <h2 className="font-heading text-xl font-bold">Competitions</h2>
          {loading ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading competitions…</p>
          ) : loadError ? (
            <div className="mt-4">
              <p className="text-sm text-destructive">{loadError}</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={retryLoad}>Try again</Button>
            </div>
          ) : competitions.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No competitions yet.</p>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {competitions.map((c) => (
                <div key={c.id} onClick={() => navigate(`/orgacube/${c.id}`)} className="group cursor-pointer">
                  <Card className="h-full hover:border-isu-blue transition-colors">
                    <CardContent className="p-6 flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-heading font-bold text-lg">{c.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {[c.location, c.startDate].filter(Boolean).join(' · ') || 'No details'}
                        </p>
                        <Badge variant="secondary" className="mt-3 uppercase text-[10px] tracking-wider">{c.status}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); e.preventDefault(); setDeleteTarget(c); }}
                          >
                            <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                          </Button>
                        )}
                        <ArrowRight className="w-5 h-5 text-isu-blue opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          )}
        </div>

        <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete competition</AlertDialogTitle>
            <AlertDialogDescription>
                This permanently deletes &ldquo;{deleteTarget?.name}&rdquo; and all of its athletes, rounds, races and calls. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={deleting}
                onClick={(e) => { e.preventDefault(); handleDelete(); }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
          </TabsContent>

          <TabsContent value="referees" className="mt-8">
            <RefereeAdmin competitions={competitions} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}