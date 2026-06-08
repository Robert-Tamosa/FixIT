"use client";

interface NearbyMechanicsSectionProps {
  mechanics: any[];
  className?: string;
}

export function NearbyMechanicsSection({ mechanics, className }: NearbyMechanicsSectionProps) {
  return (
    <div className={className}>
      <h3 className="text-white p-2">Nearby Mechanics</h3>
      <ul>
        {mechanics.map((m) => (
          <li key={m.id} className="text-white">{m.name}</li>
        ))}
      </ul>
    </div>
  );
}