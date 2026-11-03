import React from 'react';
import { Image } from '@/components/ui/image';

// The supplied white ISU artwork, with only the blue background removed and the
// transparent margin trimmed so its left edge sits flush with the page grid.
export default function IsuLogo({ className = 'h-6 sm:h-7 w-auto' }) {
  return (
    <Image
      src="https://base44.app/api/apps/6a7e05447779e40dc9f5f36a/files/mp/public/6a7e05447779e40dc9f5f36a/9e58a2b35_isu-logo-white-cropped.png"
      alt="International Skating Union"
      fittingType="fit"
      originWidth={516}
      originHeight={74}
      loading="eager"
      className={className}
    />
  );
}