import type { RideDocument } from "../models/ride.model";

export function toRideResponse(ride: RideDocument) {
  const coordinates = ride.route!.coordinates;

  return {
    id: ride._id.toString(),
    driverId: ride.driverId.toString(),
    status: ride.status,
    route: ride.route,
    origin: coordinates[0],
    destination: coordinates[coordinates.length - 1],
    routeLengthM: ride.routeLengthM,
    departureTime: ride.departureTime.toISOString(),
    seatsTotal: ride.seatsTotal,
    seatsAvailable: ride.seatsAvailable,
    pricePerSeatPaise: ride.pricePerSeatPaise,
    currency: "INR",
    priceDisplay: `₹${(
      ride.pricePerSeatPaise / 100
    ).toFixed(2)}`,
  };
}