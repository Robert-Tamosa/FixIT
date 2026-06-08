export interface SessionUser {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
}

export interface DisplayBooking {
  id: string;
  mechanicName: string;
  mechanicInitials: string;
  mechanicRating: number;
  service: string;
  status: "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "DONE";
  scheduledAt?: string | null;
  price?: string;
  vehicleLabel: string;
}
export interface DisplayMechanic {
  id: string;
  name: string;
  initials: string;
  specialty: string;
  rating: number;
  reviews: number;
  available: boolean;
}