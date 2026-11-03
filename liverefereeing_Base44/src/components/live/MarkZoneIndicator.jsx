import React from 'react';

// Very small zone hint under a MARK title in the call sheet — text only, so it
// never competes with the shared track overview above the sheet.
export default function MarkZoneIndicator({ zone }) {
  return (
    <span className={`text-[10px] font-normal leading-tight ${zone ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}>
      {zone || 'Zone not specified'}
    </span>
  );
}