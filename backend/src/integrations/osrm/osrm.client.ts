// HTTP client for OSRM (Open Source Routing Machine)
// Docs: http://project-osrm.org/docs/v5.24.0/api/

const OSRM_URL = process.env.OSRM_URL || 'http://localhost:5000';

interface NearestResult {
  lat: number;
  lng: number;
}

interface RouteResult {
  distance: number;   // meters
  duration: number;   // seconds
  geometry: string;   // polyline-encoded geometry
}

interface TableResult {
  durations: number[][]; // seconds
  distances: number[][]; // meters
}

class OsrmClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = OSRM_URL.replace(/\/+$/, '');
  }

  /**
   * Get the nearest road-snapped point for a coordinate.
   * OSRM uses [longitude, latitude] ordering.
   */
  async nearest(lat: number, lng: number): Promise<NearestResult> {
    const url = `${this.baseUrl}/nearest/v1/driving/${lng},${lat}?number=1`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`OSRM nearest failed (${response.status}): ${await response.text()}`);
    }

    const data = await response.json() as {
      code: string;
      waypoints?: Array<{ location: [number, number] }>;
    };

    if (data.code !== 'Ok' || !data.waypoints?.length) {
      throw new Error(`OSRM nearest returned no results (code: ${data.code})`);
    }

    const [snappedLng, snappedLat] = data.waypoints[0].location;
    return { lat: snappedLat, lng: snappedLng };
  }

  /**
   * Get a route between an ordered list of waypoints.
   * Coordinates are [longitude, latitude] pairs (OSRM convention).
   */
  async route(coordinates: [number, number][]): Promise<RouteResult> {
    if (coordinates.length < 2) {
      throw new Error('OSRM route requires at least 2 coordinates');
    }

    const coordString = coordinates.map(([lng, lat]) => `${lng},${lat}`).join(';');
    const url = `${this.baseUrl}/route/v1/driving/${coordString}?overview=full&geometries=polyline`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`OSRM route failed (${response.status}): ${await response.text()}`);
    }

    const data = await response.json() as {
      code: string;
      routes?: Array<{ distance: number; duration: number; geometry: string }>;
    };

    if (data.code !== 'Ok' || !data.routes?.length) {
      throw new Error(`OSRM route returned no results (code: ${data.code})`);
    }

    const route = data.routes[0];
    return {
      distance: route.distance,
      duration: route.duration,
      geometry: route.geometry,
    };
  }

  /**
   * Get a distance/duration matrix between all pairs of waypoints.
   * Coordinates are [longitude, latitude] pairs (OSRM convention).
   */
  async table(coordinates: [number, number][]): Promise<TableResult> {
    if (coordinates.length < 2) {
      throw new Error('OSRM table requires at least 2 coordinates');
    }

    const coordString = coordinates.map(([lng, lat]) => `${lng},${lat}`).join(';');
    const url = `${this.baseUrl}/table/v1/driving/${coordString}?annotations=duration,distance`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`OSRM table failed (${response.status}): ${await response.text()}`);
    }

    const data = await response.json() as {
      code: string;
      durations?: number[][];
      distances?: number[][];
    };

    if (data.code !== 'Ok') {
      throw new Error(`OSRM table returned error (code: ${data.code})`);
    }

    return {
      durations: data.durations ?? [],
      distances: data.distances ?? [],
    };
  }
}

export const osrmClient = new OsrmClient();
