import React, { useState } from 'react';
import CubeHero from '@/components/CubeHero';
import OrgaCubeGate, { isOrgaCubeUnlocked } from '@/components/orga/OrgaCubeGate';
import LoadTestPanel from '@/components/orga/LoadTestPanel';

export default function LoadTest() {
  const [unlocked, setUnlocked] = useState(() => isOrgaCubeUnlocked());

  if (!unlocked) {
    return (
      <div>
        <CubeHero
          eyebrow="ORGACube"
          title="Load test for live sessions"
          subtitle="Simulate referees opening the same call sheet at the same moment and see whether every sheet still loads."
        />
        <OrgaCubeGate onUnlock={() => setUnlocked(true)} />
      </div>
    );
  }

  return (
    <div>
      <CubeHero
        eyebrow="ORGACube"
        title="Load test for live sessions"
        subtitle="Simulate referees opening the same call sheet at the same moment and see whether every sheet still loads."
      />
      <div className="w-full px-6 lg:px-12 py-14">
        <LoadTestPanel />
      </div>
    </div>
  );
}