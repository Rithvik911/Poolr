import { z } from "zod";

const coordinateSchema = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-60).max(60)
]);

const routeSchema = z.object({
  type: z.literal("LineString"),

  coordinates: z.array(coordinateSchema)
    .min(2)
    .max(500)
}).strict();

export const createRideSchema = z.object({
  route: routeSchema,

  departureTime: z.iso.datetime({ offset: true }),

  seatsTotal: z.number()
    .int()
    .min(1)
    .max(8),

  pricePerSeatPaise: z.number()
    .int()
    .min(0)
    .max(1_000_000)
}).strict();

export type CreateRideInput = z.infer<typeof createRideSchema>;

const listRidesLimitSchema = z.preprocess(
  (value) => value ?? "10",
  z
    .string()
    .regex(/^(?:[1-9]|[1-4]\d|50)$/)
    .transform(Number),
);

export const listOwnRidesQuerySchema = z
  .object({
    limit: listRidesLimitSchema,
    cursor: z.string().min(1).max(512).optional(),
  })
  .strict();

export type ListOwnRidesQuery = z.infer<typeof listOwnRidesQuerySchema>;
