import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Radio, ArrowRight } from 'lucide-react';

export default function TcCubeDashboard({ competitions, onOpenCompetition, onLive, liveBusy, liveMsg }) {
  const [selected, setSelected] = useState('');

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="border-dashed">
        <CardContent className="p-6 flex flex-col h-full">
          <div className="flex items-center gap-3 mb-2">
            <span className="w-10 h-10 rounded bg-isu-navy text-white flex items-center justify-center">
              <ArrowRight className="w-5 h-5" />
            </span>
            <h3 className="font-heading font-bold text-lg">Review a competition</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Pick a competition to review its races, referee calls and reports.
          </p>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger><SelectValue placeholder="Select competition" /></SelectTrigger>
            <SelectContent>
              {competitions.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="mt-5 flex items-center gap-2">
            <Button
              onClick={() => selected && onOpenCompetition(selected)}
              disabled={!selected}
              className="bg-isu-blue hover:bg-isu-navy"
            >
              Open competition
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="p-6 flex flex-col h-full">
          <div className="flex items-center gap-3 mb-2">
            <span className="w-10 h-10 rounded bg-red-600 text-white flex items-center justify-center">
              <Radio className="w-5 h-5" />
            </span>
            <h3 className="font-heading font-bold text-lg">Live Module</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Jump straight to the race currently pushed live from ORGACube — no selection needed.
          </p>
          <Button onClick={onLive} disabled={liveBusy} className="bg-red-600 hover:bg-red-700 self-start">
            <Radio className="w-4 h-4 mr-2" /> {liveBusy ? 'Locating live race…' : 'Go to live race'}
          </Button>
          {liveMsg && <p className="mt-3 text-xs text-amber-700">{liveMsg}</p>}
        </CardContent>
      </Card>
    </div>
  );
}