// HTTP client for VROOM VRP solver
// Docs: https://github.com/VROOM-Project/vroom/blob/master/docs/API.md

const VROOM_URL = process.env.VROOM_URL || 'http://localhost:3000';

// ——— Input types ———

export interface VroomVehicle {
  id: number;
  start: [number, number]; // [lon, lat]
  end: [number, number];
  capacity: [number]; // [cubagem litros * 1000]
  time_window?: [number, number];
  skills?: number[];
  costs_fixed?: number;
  max_tasks?: number;
}

export interface VroomJob {
  id: number;
  location: [number, number]; // [lon, lat]
  amount: [number];
  service: number; // seconds
  time_windows?: [[number, number]];
}

export interface VroomInput {
  vehicles: VroomVehicle[];
  jobs: VroomJob[];
  options?: { g?: boolean };
}

// ——— Output types ———

export interface VroomStep {
  type: string; // "start", "job", "end"
  id?: number;
  location: [number, number];
  arrival: number;
  duration: number;
  distance: number;
}

export interface VroomRoute {
  vehicle: number;
  steps: VroomStep[];
  cost: number;
  duration: number;
  distance: number;
  amount: [number];
}

export interface VroomSummary {
  cost: number;
  routes: number;
  unassigned: number;
  duration: number;
  distance: number;
}

export interface VroomUnassigned {
  id: number;
  location: [number, number];
}

export interface VroomResult {
  code: number;
  summary: VroomSummary;
  routes: VroomRoute[];
  unassigned: VroomUnassigned[];
}

class VroomClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = VROOM_URL.replace(/\/+$/, '');
  }

  /**
   * Submit a VRP problem to VROOM and return the optimized result.
   * POST body is the full VROOM input JSON.
   */
  async solve(input: VroomInput): Promise<VroomResult> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`VROOM request failed (${response.status}): ${body}`);
    }

    const result = (await response.json()) as VroomResult;

    if (result.code !== 0) {
      throw new Error(`VROOM solver error (code ${result.code})`);
    }

    return result;
  }
}

export const vroomClient = new VroomClient();
