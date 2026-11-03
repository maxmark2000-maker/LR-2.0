import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Loader2 } from 'lucide-react';
import { orga, cubeToken } from '@/lib/cubeClient';

export function isOrgaCubeUnlocked() {
  return !!cubeToken('orga');
}

export function lockOrgaCube() {
  orga.logout();
}

export default function OrgaCubeGate({ onUnlock }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await orga.login(value);
      onUnlock?.();
    } catch (err) {
      setError(err.message || 'Incorrect password. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md">
        <CardContent className="p-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-10 h-10 rounded-full bg-isu-navy text-white flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </span>
            <div>
              <h2 className="font-heading font-bold text-lg">ORGACube access</h2>
              <p className="text-xs text-muted-foreground">Enter the ORGA password to continue.</p>
            </div>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="orgacube-pw">Password</Label>
              <Input
                id="orgacube-pw"
                type="password"
                value={value}
                onChange={(e) => { setValue(e.target.value); setError(''); }}
                autoFocus
                placeholder="••••••••"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={busy} className="w-full bg-isu-blue hover:bg-isu-navy">
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Unlock
            </Button>
          </form>
          <p className="mt-4 text-[11px] text-muted-foreground text-center">
            Restricted to competition organisers and administrators.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}