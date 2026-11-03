import React from 'react';
import { Link } from 'react-router-dom';
import Hero from '@/components/Hero';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Settings2, Radio, FileText, ArrowRight } from 'lucide-react';
import HowLiveRefereeingWorks from '@/components/live/HowLiveRefereeingWorks';
import ExampleVideo from '@/components/live/ExampleVideo';

const CUBES = [
  {
    icon: Settings2,
    name: 'ORGACube',
    tag: 'Organization & Administration',
    to: '/orgacube',
    text: 'Create competitions, register MEN and WOMEN athletes, build every round type separately per gender, define races and athlete assignments, and issue referee credentials.',
  },
  {
    icon: Radio,
    name: 'LiveRefereeing Cube',
    tag: 'Live Referee Workspace',
    to: '/live',
    text: 'Referees sign in with credentials issued by ORGACube, pick competition, gender, round and race, follow the video stream and submit private calls — even with an unstable connection.',
  },
  {
    icon: FileText,
    name: 'TCCube',
    tag: 'Aggregation & PDF Export',
    to: '/tccube',
    text: 'Technical Committee view of all referees\u2019 calls per race, aggregated counts per call code, and printable PDF reports with full race documentation.',
  },
];

export default function Home() {
  return (
    <div>
      <Hero
        eyebrow="Short Track Speed Skating"
        title="One platform for organising, refereeing and reviewing ISU short track competitions"
        subtitle="Three connected Cubes cover the full officiating workflow: administration in ORGACube, live calls in the LiveRefereeing Cube, and aggregated documentation in TCCube."
      >
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg" className="bg-isu-gradient hover:brightness-110">
            <Link to="/orgacube">Open ORGACube</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="bg-transparent text-white border-white/50 hover:bg-white hover:text-isu-navy">
            <Link to="/live">Referee login</Link>
          </Button>
        </div>
      </Hero>

      <section className="w-full px-6 lg:px-12 py-20">
        <h2 className="font-heading text-3xl font-bold tracking-tight">The three Cubes</h2>
        <p className="mt-3 text-muted-foreground max-w-2xl">Each Cube serves one role in the competition day and shares the same competition data.</p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {CUBES.map((cube) => (
            <Card key={cube.name} className="border-border/70 hover:shadow-lg transition-shadow">
              <CardContent className="p-7">
                <div className="w-11 h-11 rounded bg-accent flex items-center justify-center mb-5">
                  <cube.icon className="w-5 h-5 text-isu-blue" />
                </div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">{cube.tag}</p>
                <h3 className="font-heading text-xl font-bold mt-1">{cube.name}</h3>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{cube.text}</p>
                <Link to={cube.to} className="mt-5 inline-flex items-center gap-1 text-isu-blue font-medium text-sm hover:underline">
                  Enter {cube.name} <ArrowRight className="w-4 h-4" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="w-full px-6 lg:px-12 pb-20">
        <ExampleVideo />
      </section>

      <section className="w-full px-6 lg:px-12 pb-20">
        <HowLiveRefereeingWorks />
      </section>

    </div>
  );
}