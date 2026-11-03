import React from 'react';
import logo from '@/assets/isu-logo.png';

// Official ISU corporate logo, freestanding (transparent background).
// `mono` renders it as a solid white mark for use on the blue ISU bands.
export default function IsuLogo({ height = 14, className = '', mono = false }) {
  return (
    <img
      src={logo}
      alt="ISU"
      title="International Skating Union"
      className={`inline-block w-auto align-middle ${className}`}
      style={{ height, ...(mono ? { filter: 'brightness(0) invert(1)' } : null) }}
    />
  );
}