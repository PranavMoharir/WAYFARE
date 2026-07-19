import axios from 'axios';
import type { TripRequest, TripResponse } from '../types';

const API_BASE_URL = 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const planTrip = async (request: TripRequest): Promise<TripResponse> => {
  const response = await apiClient.post<TripResponse>('/plan-trip', request);
  return response.data;
};

export const checkHealth = async (): Promise<{ message: string }> => {
  const response = await apiClient.get<{ message: string }>('/');
  return response.data;
};
