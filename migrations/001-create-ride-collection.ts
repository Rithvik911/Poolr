import "dotenv/config";
import mongoose from "mongoose";

const COLLECTION_NAME = "rides";

const rideValidator = {
  $and: [
    {
      seatsTotal: {
        $type: ["double", "int", "long", "decimal"]
      }
    },
    {
      seatsAvailable: {
        $type: ["double", "int", "long", "decimal"]
      }
    },
    {
      $expr: {
        $and: [
          {
            $gte: ["$seatsAvailable", 0]
          },
          {
            $lte: ["$seatsAvailable", "$seatsTotal"]
          }
        ]
      }
    }
  ]
};

async function runMigration(): Promise<void> {
  const mongoURI = process.env.MONGO_URI;

  if (!mongoURI) {
    throw new Error("MONGO_URI is not defined");
  }

  await mongoose.connect(mongoURI, {
    autoIndex: false
  });

  const database = mongoose.connection.db;

  if (!database) {
    throw new Error("MongoDB connection is not ready");
  }

  const collectionExists = await database
    .listCollections({ name: COLLECTION_NAME })
    .hasNext();

  if (!collectionExists) {
    await database.createCollection(COLLECTION_NAME, {
      validator: rideValidator,
      validationLevel: "strict",
      validationAction: "error"
    });

    console.log("Created rides collection");
  } else {
    await database.command({
      collMod: COLLECTION_NAME,
      validator: rideValidator,
      validationLevel: "strict",
      validationAction: "error"
    });

    console.log("Updated rides collection validator");
  }

  const rides = database.collection(COLLECTION_NAME);

  await rides.createIndexes([
    {
      key: { route: "2dsphere" },
      name: "route_2dsphere"
    },
    {
      key: {
        status: 1,
        departureTime: 1
      },
      name: "status_1_departureTime_1"
    },
    {
      key: {
        driverId: 1,
        departureTime: -1
      },
      name: "driverId_1_departureTime_-1"
    }
  ]);

  console.log("Ride indexes are ready");

  const users = database.collection("users");

  await users.createIndex(
    { email: 1 },
    {
      name: "email_1",
      unique: true
    }
  );

  console.log("User indexes are ready");
}

runMigration()
  .catch((error: unknown) => {
    console.error("Ride migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
