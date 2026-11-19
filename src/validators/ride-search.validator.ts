import { z } from "zod";

const decimalNumberPattern = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;
const unsignedIntegerPattern = /^(?:0|[1-9]\d*)$/;

function coordinateQuery(minimum: number, maximum: number) {
  return z
    .string()
    .regex(decimalNumberPattern, "Must be a valid decimal number")
    .transform(Number)
    .pipe(z.number().finite().min(minimum).max(maximum));
}

function integerQuery(
  defaultValue: number,
  minimum: number,
  maximum: number,
) {
  return z.preprocess(
    (value) => value ?? String(defaultValue),
    z
      .string()
      .regex(unsignedIntegerPattern, "Must be a positive integer")
      .transform(Number)
      .pipe(z.number().int().min(minimum).max(maximum)),
  );
}

export const searchRidesQuerySchema = z
  .object({
    pickupLng: coordinateQuery(-180, 180),
    pickupLat: coordinateQuery(-60, 60),

    maxWalkM: integerQuery(1_000, 1, 3_000),
    seats: integerQuery(1, 1, 8),
    limit: integerQuery(20, 1, 50),

    departAfter: z.iso.datetime({ offset: true }).optional(),
    departBefore: z.iso.datetime({ offset: true }).optional(),
  })
  .strict();

export type SearchRidesQuery = z.infer<
  typeof searchRidesQuerySchema
>;