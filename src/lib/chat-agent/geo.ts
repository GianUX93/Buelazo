import { airports } from "@/lib/mock-data";

// Coordenadas aproximadas de los aeropuertos que ya cubre `airports` en
// mock-data.ts — solo para resolver "¿desde qué ciudad me escribe?" por
// cercanía real, no para nada que necesite precisión de vuelo.
const AIRPORT_COORDS: Record<string, { lat: number; lng: number }> = {
  LIM: { lat: -12.0219, lng: -77.1143 },
  CUZ: { lat: -13.5357, lng: -71.9388 },
  AQP: { lat: -16.3411, lng: -71.583 },
  PIU: { lat: -5.2057, lng: -80.6165 },
  IQT: { lat: -3.7847, lng: -73.3087 },
  TRU: { lat: -8.0814, lng: -79.1088 },
  TPP: { lat: -6.5091, lng: -76.3733 },
  CIX: { lat: -6.7871, lng: -79.8281 },
};

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Ciudad del aeropuerto propio de `airports` más cercano a una coordenada —
// solo entre las 8 ciudades que ya cubre el marketplace.
export function nearestAirportCity(lat: number, lng: number): string | null {
  let closestCode: string | null = null;
  let closestKm = Infinity;
  for (const [code, coords] of Object.entries(AIRPORT_COORDS)) {
    const km = haversineKm({ lat, lng }, coords);
    if (km < closestKm) {
      closestKm = km;
      closestCode = code;
    }
  }
  return closestCode ? (airports[closestCode]?.city ?? null) : null;
}
