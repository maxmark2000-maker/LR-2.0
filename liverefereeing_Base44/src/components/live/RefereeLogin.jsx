import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

export default function RefereeLogin({ onLogin, notice }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Enter the username and password issued by ORGACube.');
      return;
    }
    setError('');
    setLoading(true);
    // Whatever the server answers, the card has to come back to a usable state:
    // a request that never answers used to leave it on "Signing in…" for good.
    const guard = setTimeout(() => {
      setLoading(false);
      setError('Sign in is taking too long. Please check your connection and try again.');
    }, 20000);
    try {
      const res = await base44.functions.invoke('refereeLogin', { username, password });
      if (res.data?.error) {
        setError(res.data.error);
        return;
      }
      onLogin({ token: res.data.token, referee: res.data.referee });
    } catch (err) {
      setError(err?.response?.data?.error || 'Invalid credentials. Please check your username and password.');
    } finally {
      clearTimeout(guard);
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardContent className="p-7">
        <h2 className="font-heading text-xl font-bold">Referee sign in</h2>
        <p className="mt-2 text-sm text-muted-foreground">Use the credentials issued to you by ORGACube.</p>
        {notice && (
          <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p>
        )}
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="ref-user">Username</Label>
            <Input id="ref-user" autoCapitalize="none" value={username} onChange={(e) => { setUsername(e.target.value); setError(''); }} className="mt-2" />
          </div>
          <div>
            <Label htmlFor="ref-pass">Password</Label>
            <Input id="ref-pass" type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} className="mt-2" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full bg-isu-blue hover:bg-isu-navy">
            {loading ? 'Signing in…' : 'Enter LiveRefereeing Cube'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}