
import assert from "node:assert/strict";

// --------------------------------------------------
// 1. Types
// --------------------------------------------------

type Coordinate = [number, number];

type Route = {
  name: string;
  route: {
    type: "LineString";
    coordinates: Coordinate[];
  };
};

// --------------------------------------------------
// 2. Coordinate rounding
// --------------------------------------------------

// Round to six decimal places to avoid floating-point
// artifacts such as 80.21000000000001.
function roundCoordinate(value: number): number {
  return Number(value.toFixed(6));
}

// --------------------------------------------------
// 3. Seeded pseudorandom number generator
// --------------------------------------------------

// The same seed always produces the same sequence.
function createRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// --------------------------------------------------
// 4. Generate synthetic GeoJSON routes
// --------------------------------------------------

function generateRoutes(count: number, seed = 42): Route[] {
  const routes: Route[] = [];
  const random = createRandom(seed);

  for (let i = 0; i < count; i++) {
    // Synthetic starting points near Chennai.
    const longitude = 80.1 + random() * 0.3;
    const latitude = 12.9 + random() * 0.3;

    // Small movements for two route segments.
    const dx1 = (random() - 0.5) * 0.04;
    const dy1 = (random() - 0.5) * 0.04;
    const dx2 = (random() - 0.5) * 0.04;
    const dy2 = (random() - 0.5) * 0.04;

    const coordinates: Coordinate[] = [
      [
        roundCoordinate(longitude),
        roundCoordinate(latitude),
      ],
      [
        roundCoordinate(longitude + dx1),
        roundCoordinate(latitude + dy1),
      ],
      [
        roundCoordinate(longitude + dx1 + dx2),
        roundCoordinate(latitude + dy1 + dy2),
      ],
    ];

    routes.push({
      name: `Route ${i + 1}`,
      route: {
        type: "LineString",
        coordinates,
      },
    });
  }

  return routes;
}

// --------------------------------------------------
// 5. Validate generated geometry
// --------------------------------------------------

function validateRoutes(routes: Route[]): void {
  for (const { name, route } of routes) {
    assert.equal(
      route.type,
      "LineString",
      `${name}: geometry must be a LineString`
    );

    assert.equal(
      route.coordinates.length,
      3,
      `${name}: expected three coordinates`
    );

    // Validate longitude and latitude ranges.
    for (const [longitude, latitude] of route.coordinates) {
      assert.ok(
        Number.isFinite(longitude) &&
          longitude >= -180 &&
          longitude <= 180,
        `${name}: invalid longitude`
      );

      assert.ok(
        Number.isFinite(latitude) &&
          latitude >= -90 &&
          latitude <= 90,
        `${name}: invalid latitude`
      );
    }

    // Consecutive route points must not be identical.
    for (let i = 1; i < route.coordinates.length; i++) {
      assert.notDeepEqual(
        route.coordinates[i],
        route.coordinates[i - 1],
        `${name}: consecutive route points must differ`
      );
    }
  }
}

// --------------------------------------------------
// 6. Initial correctness checks
// --------------------------------------------------

const SEED = 42;
const ROUTE_COUNT = 100_000;

const routes = generateRoutes(ROUTE_COUNT, SEED);

assert.equal(
  routes.length,
  ROUTE_COUNT,
  "Generated route count must match"
);

validateRoutes(routes);

console.log("Geometry validation: passed");

// console.log("Generated routes:");
// console.log(JSON.stringify(routes, null, 2));

// --------------------------------------------------
// 7. Verify route reproducibility
// --------------------------------------------------

const repeatedRoutes = generateRoutes(ROUTE_COUNT, SEED);

assert.deepEqual(
  routes,
  repeatedRoutes,
  "Same seed must generate identical routes"
);

console.log("Routes reproducible: true");

// --------------------------------------------------
// 8. Verify PRNG reproducibility
// --------------------------------------------------

const randomA = createRandom(SEED);
const randomB = createRandom(SEED);

const sequenceA = [
  randomA(),
  randomA(),
  randomA(),
];

const sequenceB = [
  randomB(),
  randomB(),
  randomB(),
];

assert.deepEqual(
  sequenceA,
  sequenceB,
  "Same seed must generate identical random sequences"
);

console.log("Sequence A:", sequenceA);
console.log("Sequence B:", sequenceB);
console.log("PRNG reproducibility: passed");
async function insertBenchmarkRoutes(): Promise<void> {
  await import("dotenv/config");
  const { default: mongoose } = await import("mongoose");

  await mongoose.connect(process.env.MONGO_URI!);

  try {
    const collection =
mongoose.connection.db!.collection<Route>("s2benchmark100k");

    // Prevent accidental duplicate benchmark data.
    const existingCount = await collection.countDocuments();

    assert.equal(
      existingCount,
      0,
      "Benchmark collection must be empty before insertion"
    );

    const batchSize = 1_000;

    for (let i = 0; i < routes.length; i += batchSize) {
      const batch = routes.slice(i, i + batchSize);

      await collection.insertMany(batch, { ordered: true });

      console.log(
        `Inserted ${Math.min(i + batch.length, routes.length)}/${routes.length}`
      );
    }

    const finalCount = await collection.countDocuments();

    assert.equal(
      finalCount,
      routes.length,
      "MongoDB document count must match generated route count"
    );

    console.log("Benchmark insertion: passed");
    console.log("Final document count:", finalCount);
  } finally {
    await mongoose.disconnect();
  }
}

if (process.env.RUN_S2_INSERT === "true") {
  insertBenchmarkRoutes().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
} else {
  console.log(
    "Database insertion skipped. Set RUN_S2_INSERT=true to insert."
  );
}