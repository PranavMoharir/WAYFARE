import { create } from 'zustand';
import type { TripRequest, TripResponse } from '../types';

interface TripStore {
  request: TripRequest | null;
  response: TripResponse | null;
  isLoading: boolean;
  error: string | null;
  setRequest: (req: TripRequest) => void;
  setResponse: (res: TripResponse) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
  reset: () => void;
}

export const useTripStore = create<TripStore>((set) => ({
  request: null,
  response: null,
  isLoading: false,
  error: null,
  setRequest: (request) => set({ request }),
  setResponse: (response) => set({ response }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  reset: () => set({ request: null, response: null, isLoading: false, error: null }),
}));
