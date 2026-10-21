
import assert from "node:assert/strict";
import "dotenv/config";
import mongoose from "mongoose";
import { circle } from "@turf/turf";

// --------------------------------------------------
// 1. Types and configuration
// --------------------------------------------------

type Coordinate = [number, number];

type Route = {
  name: string;
  route: {
    type: "LineString";
    coordinates: Coordinate[];
  };
};

type DatasetSize = "10k" | "100k";

const SEED = 42;
const BATCH_SIZE = 1_000;

const DATASETS = {
  "10k": {
    count: 10_000,
    collection: "s2benchmark",
  },
  "100k": {
    count: 100_000,
    collection: "s2benchmark100k",
  },
} as const;

const dataset = process.env.S2_DATASET ?? "100k";

assert.ok(
  dataset === "10k" || dataset === "100k",
  "S2_DATASET must be '10k' or '100k'"
);

const selectedDataset = dataset as DatasetSize;
const config = DATASETS[selectedDataset];

const shouldInsert = process.env.RUN_S2_INSERT === "true";
const shouldBenchmark = process.env.RUN_S2_BENCHMARK === "true";

assert.ok(
  !(shouldInsert && shouldBenchmark),
  "Insertion and benchmarking must run separately"
);

// --------------------------------------------------
// 2. Deterministic route generation
// --------------------------------------------------

function roundCoordinate(value: number): number {
  return Number(value.toFixed(6));
}

function createRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state =
      (Math.imul(1664525, state) + 1013904223) >>> 0;

    return state / 4294967296;
  };
}

function generateRoutes(count: number, seed = SEED): Route[] {
  const random = createRandom(seed);
  const routes: Route[] = [];

  for (let i = 0; i < count; i++) {
    // Synthetic routes around Chennai.
    // These are not actual road geometries.
    const longitude = 80.1 + random() * 0.3;
    const latitude = 12.9 + random() * 0.3;

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
// 3. GeoJSON validation
// --------------------------------------------------

function validateRoutes(routes: Route[]): void {
  for (const { name, route } of routes) {
    assert.equal(
      route.type,
      "LineString",
      `${name}: expected LineString geometry`
    );

    assert.equal(
      route.coordinates.length,
      3,
      `${name}: expected three coordinates`
    );

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

    for (let i = 1; i < route.coordinates.length; i++) {
      assert.notDeepEqual(
        route.coordinates[i],
        route.coordinates[i - 1],
        `${name}: consecutive coordinates must differ`
      );
    }
  }
}

// --------------------------------------------------
// 4. Generation and reproducibility checks
// --------------------------------------------------

function validateGenerator(): void {
  const routes = generateRoutes(config.count, SEED);

  assert.equal(routes.length, config.count);
  validateRoutes(routes);

  console.log("Geometry validation: passed");

  const repeatedRoutes = generateRoutes(config.count, SEED);

  assert.deepEqual(
    routes,
    repeatedRoutes,
    "Same seed must produce identical routes"
  );

  console.log("Routes reproducible: true");

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

  assert.deepEqual(sequenceA, sequenceB);

  console.log("PRNG reproducibility: passed");
}

// --------------------------------------------------
// 5. Geospatial index
// --------------------------------------------------

async function ensureGeospatialIndex(
  collection: mongoose.mongo.Collection<Route>
): Promise<void> {
  const indexName = await collection.createIndex({
    route: "2dsphere",
  });

  assert.equal(
    indexName,
    "route_2dsphere",
    "Unexpected geospatial index name"
  );

  console.log("Geospatial index ready:", indexName);
}

async function verifyGeospatialIndex(
  collection: mongoose.mongo.Collection<Route>
): Promise<void> {
  const indexes = await collection.listIndexes().toArray();

  const geoIndex = indexes.find(
    (index) =>
      index.name === "route_2dsphere" &&
      index.key?.route === "2dsphere"
  );

  assert.ok(
    geoIndex,
    "Missing route_2dsphere index. Prepare the dataset first."
  );

  console.log("Geospatial index verified:", geoIndex.name);
}

// --------------------------------------------------
// 6. Benchmark dataset insertion
// --------------------------------------------------

async function insertBenchmarkRoutes(): Promise<void> {
  const collection =
    mongoose.connection.db!.collection<Route>(
      config.collection
    );

  const existingCount = await collection.countDocuments();

  assert.equal(
    existingCount,
    0,
    "Benchmark collection must be empty before insertion"
  );

  await ensureGeospatialIndex(collection);

  const routes = generateRoutes(config.count, SEED);
  validateRoutes(routes);

  for (let i = 0; i < routes.length; i += BATCH_SIZE) {
    const batch = routes.slice(i, i + BATCH_SIZE);

    await collection.insertMany(batch, {
      ordered: true,
    });

    console.log(
      `Inserted ${Math.min(i + batch.length, routes.length)}/${routes.length}`
    );
  }

  const finalCount = await collection.countDocuments();

  assert.equal(
    finalCount,
    config.count,
    "Incorrect final benchmark document count"
  );

  console.log("Benchmark insertion: passed");
  console.log("Final document count:", finalCount);
}

// --------------------------------------------------
// 7. Extract execution statistics
// --------------------------------------------------

function printExecutionStats(
  queryName: string,
  stats: {
    nReturned: number;
    totalDocsExamined: number;
    totalKeysExamined: number;
    executionTimeMillis: number;
  }
): void {
  console.log(`\n${queryName}`);

  console.log({
    nReturned: stats.nReturned,
    totalDocsExamined: stats.totalDocsExamined,
    totalKeysExamined: stats.totalKeysExamined,
    executionTimeMillis: stats.executionTimeMillis,
  });
}

// --------------------------------------------------
// 8. $geoIntersects benchmark
// --------------------------------------------------

async function benchmarkGeoIntersects(
  collection: mongoose.mongo.Collection<Route>
): Promise<void> {
  const polygon = {
    type: "Polygon" as const,
    coordinates: [
      [
        [80.24, 13.04],
        [80.26, 13.04],
        [80.26, 13.06],
        [80.24, 13.06],
        [80.24, 13.04],
      ],
    ],
  };

  const explain = await collection
    .find({
      route: {
        $geoIntersects: {
          $geometry: polygon,
        },
      },
    })
    .explain("executionStats");

  const stats = explain.executionStats;

  assert.ok(
    stats,
    "Missing $geoIntersects execution statistics"
  );

  printExecutionStats("$geoIntersects benchmark:", {
    nReturned: stats.nReturned,
    totalDocsExamined: stats.totalDocsExamined,
    totalKeysExamined: stats.totalKeysExamined,
    executionTimeMillis: stats.executionTimeMillis,
  });
}

// --------------------------------------------------
// 9. $geoNear benchmark
// --------------------------------------------------

async function benchmarkTwoCircleIntersects(
  collection: mongoose.mongo.Collection<Route>
): Promise<void> {
  // Use an existing seeded route to ensure the query
  // has at least one matching candidate.
  const seededRoute = await collection.findOne({});

  assert.ok(seededRoute, "No seeded routes found");

  const coordinates = seededRoute.route.coordinates;

  assert.ok(
    coordinates.length >= 2,
    "Seeded route must contain at least two coordinates"
  );

  const pickup = coordinates[0];
  const dropoff = coordinates[coordinates.length - 1];

  // Experimental 1 km radius, inflated by 1%.
  const createCircle = (location: Coordinate) =>
    circle(location, 1 * 1.01, {
      steps: 64,
      units: "kilometers",
    }).geometry;

  const filter = {
    $and: [
      {
        route: {
          $geoIntersects: {
            $geometry: createCircle(pickup),
          },
        },
      },
      {
        route: {
          $geoIntersects: {
            $geometry: createCircle(dropoff),
          },
        },
      },
    ],
  };

  const explain = await collection
    .find(filter)
    .explain("executionStats");

  const stats = explain.executionStats;

  assert.ok(
    stats,
    "Missing two-circle execution statistics"
  );

  console.log("\nTwo-circle candidate query:");
  console.log("Pickup:", pickup);
  console.log("Drop-off:", dropoff);

  printExecutionStats("$geoIntersects two-circle:", {
    nReturned: stats.nReturned,
    totalDocsExamined: stats.totalDocsExamined,
    totalKeysExamined: stats.totalKeysExamined,
    executionTimeMillis: stats.executionTimeMillis,
  });
}


async function benchmarkGeoNear(
  collection: mongoose.mongo.Collection<Route>
): Promise<void> {
  const pipeline = [
    {
      $geoNear: {
        near: {
          type: "Point",
          coordinates: [80.25, 13.05],
        },
        distanceField: "distanceMeters",
        maxDistance: 3_000,
        spherical: true,
        key: "route",
      },
    },
  ];

  const explain = await collection
    .aggregate(pipeline)
    .explain("executionStats");

  const geoNearStage = explain.stages?.find(
    (stage: Record<string, unknown>) =>
      "$geoNearCursor" in stage
  );

  assert.ok(
    geoNearStage?.$geoNearCursor?.executionStats,
    "Missing $geoNear execution statistics"
  );

  const stats =
    geoNearStage.$geoNearCursor.executionStats;

  printExecutionStats("$geoNear benchmark:", {
    nReturned: stats.nReturned,
    totalDocsExamined: stats.totalDocsExamined,
    totalKeysExamined: stats.totalKeysExamined,
    executionTimeMillis: stats.executionTimeMillis,
  });
}

// --------------------------------------------------
// 10. Run read-only geospatial benchmarks
// --------------------------------------------------

async function runGeospatialBenchmarks(): Promise<void> {
  const collection =
    mongoose.connection.db!.collection<Route>(
      config.collection
    );

  const documentCount = await collection.countDocuments();

  assert.equal(
    documentCount,
    config.count,
    "Dataset size mismatch. Prepare the dataset first."
  );

  await verifyGeospatialIndex(collection);

  console.log("\nBenchmark configuration:");
  console.log("Dataset:", selectedDataset);
  console.log("Collection:", config.collection);
  console.log("Routes:", documentCount);
  console.log("Seed:", SEED);

  await benchmarkGeoIntersects(collection);
  await benchmarkTwoCircleIntersects(collection);
  await benchmarkGeoNear(collection);

  console.log("\nBenchmark execution: completed");
}

// --------------------------------------------------
// 11. Entry point
// --------------------------------------------------

async function main(): Promise<void> {
  console.log("Poolr — MongoDB Geospatial Experiment");
  console.log("Selected dataset:", selectedDataset);

  if (!shouldInsert && !shouldBenchmark) {
    validateGenerator();

    console.log(
      "Database operations skipped. Set RUN_S2_INSERT=true or RUN_S2_BENCHMARK=true."
    );

    return;
  }

  assert.ok(
    process.env.MONGO_URI,
    "MONGO_URI is required for database operations"
  );


  await mongoose.connect(process.env.MONGO_URI);

  try {
    const admin = mongoose.connection.db!.admin();

    const serverInfo = await admin.serverInfo();
    const hello = await admin.command({ hello: 1 });

    console.log("MongoDB server version:", serverInfo.version);
    console.log("MongoDB replica set:", hello.setName ?? "none");
    console.log("MongoDB primary:", hello.isWritablePrimary);
    console.log("MongoDB server process ID:", hello.topologyVersion?.processId);

    if (shouldInsert) {
      await insertBenchmarkRoutes();
    } else {
      await runGeospatialBenchmarks();
    }
  } finally {
    await mongoose.disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
