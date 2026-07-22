// All shared TypeScript types for the Wayfare application

// ─── API Request ────────────────────────────────────────────────────────────
export interface TripRequest {
  origin: string;
  destination: string;
  dates: string;        // e.g. "2026-09-15 to 2026-09-18"
  budget: number;
  num_people: number;
  preferences: string[];
}

// ─── API Response ────────────────────────────────────────────────────────────

export interface Flight {
  airline?: string;
  flight_number?: string;
  origin?: string;
  destination?: string;
  departure_time?: string;
  arrival_time?: string;
  price?: number | string;
  duration?: string;
  [key: string]: unknown; // allow extra fields from backend
}

export interface Hotel {
  name?: string;
  location?: string;
  price_per_night?: number | string;
  rating?: number;
  amenities?: string[];
  [key: string]: unknown;
}

export interface Activity {
  name: string;
  reason: string;
  estimated_duration: string;
  category:
    | 'Museum'
    | 'Park'
    | 'Landmark'
    | 'Historic Landmark'
    | 'Religious Site'
    | 'Local Experience'
    | 'Nature'
    | 'Attraction'
    | string;
}

export interface Proposal {
  flight: Flight | null;
  hotel: Hotel | null;
  activities: Activity[];
  total_cost: number;
  floor_cost: number;
  shortfall?: number;
}

export interface TripResponse {
  origin: string;
  destination: string;
  dates: string;
  budget: number;
  num_people: number;
  preferences: string[];
  flight_options: Flight[];
  hotel_options: Hotel[];
  activities: Activity[];
  current_proposal: Proposal | null;
  budget_check_passed: boolean;
  budget_infeasible: boolean;
  data_incomplete?: boolean;
  incomplete_reason?: string;
  round_count: number;
}
