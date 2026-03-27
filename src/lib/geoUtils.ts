export interface Coordinate {
  latitude: number;
  longitude: number;
}

/**
 * Calculates the great-circle distance between two points on the Earth surface using the Haversine formula.
 * 
 * @param coord1 First coordinate (e.g. Technician Location)
 * @param coord2 Second coordinate (e.g. Task Location)
 * @returns Distance in kilometers
 */
export function calculateHaversineDistance(coord1: Coordinate, coord2: Coordinate): number {
  if (!coord1 || !coord2 || isNaN(coord1.latitude) || isNaN(coord1.longitude) || isNaN(coord2.latitude) || isNaN(coord2.longitude)) {
    return Infinity;
  }

  const R = 6371; // Radius of the Earth in km
  const dLat = (coord2.latitude - coord1.latitude) * (Math.PI / 180);
  const dLon = (coord2.longitude - coord1.longitude) * (Math.PI / 180);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(coord1.latitude * (Math.PI / 180)) * Math.cos(coord2.latitude * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in km
  
  return distance;
}

/**
 * Checks if a point is inside a polygon (Zone).
 * Ray-casting algorithm based on https://github.com/substack/point-in-polygon
 * 
 * @param point Coordinate to check
 * @param polygon Array of coordinates defining the polygon boundary
 * @returns boolean indicating if point is inside
 */
export function isPointInPolygon(point: Coordinate, polygon: Coordinate[]): boolean {
  if (!polygon || polygon.length < 3) return false;

  const x = point.longitude;
  const y = point.latitude;
  
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].longitude, yi = polygon[i].latitude;
    const xj = polygon[j].longitude, yj = polygon[j].latitude;
    
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  
  return inside;
}
