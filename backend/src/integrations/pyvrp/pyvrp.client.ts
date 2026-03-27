// HTTP client for PyVRP FastAPI solver container

const PYVRP_URL = process.env.PYVRP_URL || 'http://localhost:8000';

// --- Input types ---

export interface PyvrpVehicle {
  id: number;
  start: [number, number]; // [lon, lat]
  end: [number, number];
  capacity: number;
  max_duration?: number;
}

export interface PyvrpJob {
  id: number;
  location: [number, number]; // [lon, lat]
  demand: number;
  service_time: number; // seconds
}

export interface PyvrpOptions {
  mode: 'ABSOLUTO' | 'LARGE_VAN' | 'BALANCEADO';
  max_duration_hours?: number;
}

export interface PyvrpInput {
  vehicles: PyvrpVehicle[];
  jobs: PyvrpJob[];
  options: PyvrpOptions;
}

// --- Output types ---

export interface PyvrpStop {
  job_id: number;
  location: [number, number];
  arrival_time: number;
}

export interface PyvrpRoute {
  vehicle_id: number;
  stops: PyvrpStop[];
  distance: number;
  duration: number;
}

export interface PyvrpSummary {
  total_distance: number;
  total_duration: number;
  num_routes: number;
}

export interface PyvrpResult {
  routes: PyvrpRoute[];
  unassigned: number[];
  summary: PyvrpSummary;
}

class PyvrpClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = PYVRP_URL.replace(/\/+$/, '');
  }

  /**
   * Submit a VRP problem to PyVRP and return the optimized result.
   * POST /solve with the full PyVRP input JSON.
   */
  async solve(input: PyvrpInput): Promise<PyvrpResult> {
    const response = await fetch(`${this.baseUrl}/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`PyVRP request failed (${response.status}): ${body}`);
    }

    const result = (await response.json()) as PyvrpResult;

    if (!result.routes) {
      throw new Error('PyVRP solver returned invalid result (missing routes)');
    }

    return result;
  }
}

export const pyvrpClient = new PyvrpClient();
