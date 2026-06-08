"use client";

interface ActiveBookingCardProps {
  booking: any;
  mechanicName: string;
  mechanicInitials: string;
  mechanicRating: number;
  service: string;
  status: string;
  scheduledAt: string | null;
  price: string;
  vehicleLabel: string;
}

export function ActiveBookingCard(props: ActiveBookingCardProps) {
  return (
    <div className="p-4 bg-zinc-800 rounded text-white">
      <h3>{props.service}</h3>
      <p>{props.mechanicName} ({props.mechanicInitials})</p>
      <p>Vehicle: {props.vehicleLabel}</p>
      <p>Status: {props.status}</p>
    </div>
  );
}