import React from 'react';
import { Button } from '@/components/ui/button';
import { Flag } from 'lucide-react';
import VideoTimestampEditor from '@/components/live/VideoTimestampEditor';

// Subtle personal-review flag for the race a referee is working on. It is only a
// marker for the referee — the official TC flag lives in TCCube.
export default function RaceReviewFlag({ flag, onSet, busy = false }) {
  const flagged = !!flag;
  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => onSet({ flagged: !flagged })}
        className={flagged
          ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 hover:text-amber-900'
          : 'border-border text-muted-foreground hover:border-amber-300 hover:text-amber-700'}
      >
        <Flag className={`w-3.5 h-3.5 mr-1.5 ${flagged ? 'fill-amber-400 text-amber-600' : ''}`} />
        {flagged ? 'Flagged' : 'Flag for Review'}
      </Button>
      {flagged && (
        <VideoTimestampEditor
          value={flag?.videoTimestamp || ''}
          busy={busy}
          onSave={(videoTimestamp) => onSet({ flagged: true, videoTimestamp })}
        />
      )}
    </div>
  );
}