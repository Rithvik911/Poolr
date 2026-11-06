import {
  Schema,
  model,
  type HydratedDocument,
  type InferSchemaType,
} from "mongoose";

export const RIDE_STATUSES = [
  "SCHEDULED",
  "STARTED",
  "COMPLETED",
  "CANCELLED",
] as const;

export type RideStatus = (typeof RIDE_STATUSES)[number];

/**
 * Validates the structural rules that belong close to persistence.
 *
 * Business calculations such as route length are performed by the service,
 * because the server—not the client—must derive routeLengthM.
 */
function hasValidRouteCoordinates(value: unknown): boolean {
  if (!Array.isArray(value) || value.length < 2 || value.length > 500) {
    return false;
  }

  return value.every((coordinate, index) => {
    if (!Array.isArray(coordinate) || coordinate.length !== 2) {
      return false;
    }

    const [longitude, latitude] = coordinate;

    if (
      typeof longitude !== "number" ||
      typeof latitude !== "number" ||
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude) ||
      longitude < -180 ||
      longitude > 180 ||
      latitude < -60 ||
      latitude > 60
    ) {
      return false;
    }

    if (index > 0) {
      const previousCoordinate = value[index - 1];

      if (!Array.isArray(previousCoordinate)) {
        return false;
      }

      const [previousLongitude, previousLatitude] = previousCoordinate;

      // Consecutive duplicate points create a zero-length route segment.
      if (longitude === previousLongitude && latitude === previousLatitude) {
        return false;
      }

      // Poolr v0.1 does not support routes crossing the antimeridian.
      if (Math.abs(longitude - previousLongitude) > 180) {
        return false;
      }
    }

    return true;
  });
}

const rideSchema = new Schema(
  {
    // Ownership comes from the authenticated user, never the request body.
    driverId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },

    status: {
      type: String,
      enum: RIDE_STATUSES,
      default: "SCHEDULED",
      required: true,
    },

    // GeoJSON coordinates must always use [longitude, latitude] order.
    route: {
      type: {
        type: String,
        enum: ["LineString"],
        default: "LineString",
        required: true,
        immutable: true,
      },
      coordinates: {
        type: [[Number]],
        required: true,
        immutable: true,
        validate: {
          validator: hasValidRouteCoordinates,
          message:
            "Route must contain 2–500 valid [longitude, latitude] coordinates",
        },
      },
    },

    // Derived by the server from route coordinates.
    routeLengthM: {
      type: Number,
      required: true,
      min: 500,
      immutable: true,
    },

    departureTime: {
      type: Date,
      required: true,
      immutable: true,
    },

    seatsTotal: {
      type: Number,
      required: true,
      min: 1,
      max: 8,
      validate: Number.isInteger,
      immutable: true,
    },

    // The creation service will initialize this to seatsTotal.
    seatsAvailable: {
      type: Number,
      required: true,
      min: 0,
      max: 8,
      validate: Number.isInteger,
    },

    // Money is stored as integer paise, never as a floating-point rupee value.
    pricePerSeatPaise: {
      type: Number,
      required: true,
      min: 0,
      max: 1_000_000,
      validate: Number.isInteger,
      immutable: true,
    },
  },
  {
    timestamps: true,
  },
);

export type Ride = InferSchemaType<typeof rideSchema>;
export type RideDocument = HydratedDocument<Ride>;

export const RideModel = model<Ride>("Ride", rideSchema);
