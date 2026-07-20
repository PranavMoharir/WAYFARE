import axios from 'axios';
import type { TripRequest, TripResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

// The planning graph runs a Wikipedia RAG step and can take 20-90s, so the
// per-request timeout is set well above that rather than axios' default.
const PLAN_TIMEOUT_MS = 180_000;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: PLAN_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const planTrip = async (request: TripRequest): Promise<TripResponse> => {
  const response = await apiClient.post<TripResponse>('/plan-trip', request);
  return response.data;
};

export const checkHealth = async (): Promise<{ message: string }> => {
  const response = await apiClient.get<{ message: string }>('/', { timeout: 5_000 });
  return response.data;
};
