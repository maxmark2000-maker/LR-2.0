import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, LayoutList, CalendarDays, Table, BarChart3 } from 'lucide-react';
import TcPanelHeader from '@/components/tc/TcPanelHeader';

const SECTIONS = [
  {
    value: 'overview',
    label: 'Race overview',
    icon: LayoutList,
    description: 'All races of this competition at a glance — final decision status, referee agreement and revised decisions.',
  },
  {
    value: 'schedule',
    label: 'Schedule',
    icon: CalendarDays,
    description: 'The running order of the competition as scheduled in ORGACube, with the times for every race.',
  },
  {
    value: 'aggregation',
    label: 'Race Aggregation',
    icon: Table,
    description: 'Every referee\'s submitted calls for a single race, mark by mark, compared with the official Final Call.',
  },
  {
    value: 'scores',
    label: 'TC Referee Statistics',
    icon: BarChart3,
    description: 'How each referee performed across the whole competition — agreement per race and overall ranking.',
  },
];

export default function TcCubeTabHome({ competition, onOpenTab, onBack }) {
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-isu-navy/20 shadow-md">
        <TcPanelHeader
          eyebrow="TCCube"
          title={competition?.name || 'Competition'}
          subtitle="Pick a section below. Every section covers this competition."
          actions={(
            <Button
              variant="outline"
              size="sm"
              onClick={onBack}
              className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to competitions
            </Button>
          )}
        />
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map(({ value, label, icon: Icon, description }) => (
          <button key={value} type="button" onClick={() => onOpenTab(value)} className="group text-left">
            <Card className="h-full transition-colors group-hover:border-isu-blue">
              <CardContent className="flex h-full flex-col gap-3 p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded bg-isu-navy text-white">
                  <Icon className="w-5 h-5" />
                </span>
                <h3 className="font-heading text-lg font-bold">{label}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
                <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-isu-blue opacity-0 transition-opacity group-hover:opacity-100">
                  Open <ArrowRight className="w-4 h-4" />
                </span>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}