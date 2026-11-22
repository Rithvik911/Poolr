import type { Coordinate } from "../api";

const EARTH_RADIUS_M = 6_371_008.8;
const radians = (degrees: number) => degrees * Math.PI / 180;

export function segmentLengthM(a: Coordinate, b: Coordinate): number {
  const dLat = radians(b[1] - a[1]);
  const dLng = radians(b[0] - a[0]);
  const lat1 = radians(a[1]);
  const lat2 = radians(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function routeLengthM(points: Coordinate[]): number {
  return points.slice(1).reduce((total, point, index) => total + segmentLengthM(points[index]!, point), 0);
}

export function validateRoute(points: Coordinate[]): string | null {
  if (points.length < 2) return "Add at least two points to draw a route.";
  if (points.length > 500) return "A route can have at most 500 points.";
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    if (previous[0] === current[0] && previous[1] === current[1]) return "Two neighbouring route points can’t be identical.";
    if (Math.abs(previous[0] - current[0]) > 180) return "Routes crossing the antimeridian aren’t supported yet.";
  }
  if (routeLengthM(points) < 500) return "Draw at least 500 m before publishing.";
  return null;
}

export const BENGALURU_ROUTES: Record<string, Coordinate[]> = {
  "Majestic → Indiranagar": [[77.5727, 12.9784], [77.5845, 12.9762], [77.5946, 12.9716], [77.6102, 12.9701], [77.6412, 12.9784]],
  "Jayanagar → Koramangala": [[77.5838, 12.925], [77.5951, 12.9369], [77.6044, 12.9454], [77.6245, 12.9352]],
  "Yeshwanthpur → Hebbal": [[77.5547, 13.0285], [77.5662, 13.036], [77.5853, 13.041], [77.591, 13.0504]],
};
