
import "dotenv/config";
import mongoose from "mongoose";
import assert from "node:assert/strict";

// ==================================================
// 1. Experimental configuration
// ==================================================

const CONCURRENT_PASSENGERS = 50;
const INITIAL_SEATS = 1;

// ==================================================
// 2. Experimental database models
// ==================================================

const rideSchema = new mongoose.Schema({
  availableSeats: {
    type: Number,
    required: true,
    min: 0,
  },
});

const Ride = mongoose.model("S4Ride", rideSchema);

const bookingSchema = new mongoose.Schema({
  rideId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  passengerId: {
    type: String,
    required: true,
  },
});

// Prevent the same passenger from booking the same
// ride more than once.
bookingSchema.index(
  { rideId: 1, passengerId: 1 },
  { unique: true }
);

// We create indexes explicitly after clearing the
// experimental records.
bookingSchema.set("autoIndex", false);

const Booking = mongoose.model(
  "S4Booking",
  bookingSchema
);

// ==================================================
// 3. Unsafe booking: check-then-act race condition
// ==================================================

async function unsafeBookSeat(
  rideId: mongoose.Types.ObjectId,
  passengerId: string
): Promise<boolean> {
  const ride = await Ride.findById(rideId);

  if (!ride || ride.availableSeats <= 0) {
    return false;
  }

  // Deliberately widen the race window.
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 25);
  });

  await Booking.create({
    rideId,
    passengerId,
  });

  // Unsafe: overwrites the seat count using a
  // previously read value.
  await Ride.updateOne(
    { _id: rideId },
    {
      $set: {
        availableSeats: ride.availableSeats - 1,
      },
    }
  );

  return true;
}

// ==================================================
// 4. Atomic booking: conditional seat reservation
// ==================================================

async function atomicBookSeat(
  rideId: mongoose.Types.ObjectId,
  passengerId: string
): Promise<boolean> {
  const updatedRide = await Ride.findOneAndUpdate(
    {
      _id: rideId,
      availableSeats: { $gt: 0 },
    },
    {
      $inc: { availableSeats: -1 },
    },
    {
      returnDocument: "after",
    }
  );

  if (!updatedRide) {
    return false;
  }

  // This insert is NOT in the same transaction
  // as the seat decrement.
  await Booking.create({
    rideId,
    passengerId,
  });

  return true;
}

// ==================================================
// 5. Transactional booking
// ==================================================

async function transactionalBookSeat(
  rideId: mongoose.Types.ObjectId,
  passengerId: string,
  simulateFailure = false
): Promise<boolean> {
  const session = await mongoose.startSession();

  try {
    return await session.withTransaction(async () => {
      const updatedRide = await Ride.findOneAndUpdate(
        {
          _id: rideId,
          availableSeats: { $gt: 0 },
        },
        {
          $inc: { availableSeats: -1 },
        },
        {
          session,
          returnDocument: "after",
        }
      );

      if (!updatedRide) {
        return false;
      }

      // Deliberately fail after decrementing the seat.
      // MongoDB must roll back the decrement.
      if (simulateFailure) {
        throw new Error("Simulated booking failure");
      }

      await Booking.create(
        [{ rideId, passengerId }],
        { session, ordered: true }
      );

      return true;
    });
  } finally {
    await session.endSession();
  }
}

// ==================================================
// 6. Test database preparation
// ==================================================

async function prepareDatabase(): Promise<void> {
  // These are isolated S4 experiment collections.
  await Ride.createCollection();
  await Booking.createCollection();

  // Remove previous experiment records.
  // Never run destructive test resets against
  // a production database.
  await Booking.deleteMany({});
  await Ride.deleteMany({});

  // The previous runs produced duplicate bookings.
  // Build the unique index only after clearing them.
  await Booking.createIndexes();

  // Verify that the compound unique index exists.
  const indexes = await Booking.collection.indexes();

  const uniqueIndex = indexes.find(
    (index) =>
      index.unique === true &&
      index.key?.rideId === 1 &&
      index.key?.passengerId === 1
  );

  assert.ok(
    uniqueIndex,
    "Compound unique booking index must exist"
  );

  console.log("S4 unique booking index verified");
}

// ==================================================
// 7. Experiment 1: Unsafe concurrent booking
// ==================================================

async function testUnsafeBooking(): Promise<void> {
  const ride = await Ride.create({
    availableSeats: INITIAL_SEATS,
  });

  console.log("Test ride created:", ride._id.toString());
  console.log("Available seats:", ride.availableSeats);

  const results = await Promise.all(
    Array.from(
      { length: CONCURRENT_PASSENGERS },
      (_, index) =>
        unsafeBookSeat(
          ride._id,
          `unsafe-passenger-${index + 1}`
        )
    )
  );

  const successfulRequests =
    results.filter(Boolean).length;

  const bookingCount = await Booking.countDocuments({
    rideId: ride._id,
  });

  const finalRide = await Ride.findById(ride._id);

  assert.ok(finalRide, "Unsafe test ride must exist");

  const overbooked = bookingCount > INITIAL_SEATS;

  console.log("\nUnsafe booking experiment:");
  console.log("Successful requests:", successfulRequests);
  console.log("Booking records:", bookingCount);
  console.log("Remaining seats:", finalRide.availableSeats);
  console.log("Overbooking detected:", overbooked);

  // The unsafe race is probabilistic.
  // Do not require overbooking on every run.
}

// ==================================================
// 8. Experiment 2: Atomic concurrent booking
// ==================================================

async function testAtomicBooking(): Promise<void> {
  const ride = await Ride.create({
    availableSeats: INITIAL_SEATS,
  });

  const results = await Promise.all(
    Array.from(
      { length: CONCURRENT_PASSENGERS },
      (_, index) =>
        atomicBookSeat(
          ride._id,
          `atomic-passenger-${index + 1}`
        )
    )
  );

  const successfulRequests =
    results.filter(Boolean).length;

  const bookingCount = await Booking.countDocuments({
    rideId: ride._id,
  });

  const finalRide = await Ride.findById(ride._id);

  assert.ok(finalRide, "Atomic test ride must exist");

  console.log("\nAtomic booking experiment:");
  console.log("Successful requests:", successfulRequests);
  console.log("Booking records:", bookingCount);
  console.log("Remaining seats:", finalRide.availableSeats);

  assert.equal(
    successfulRequests,
    INITIAL_SEATS,
    "Exactly one passenger should reserve the seat"
  );

  assert.equal(
    bookingCount,
    INITIAL_SEATS,
    "Exactly one booking record should exist"
  );

  assert.equal(
    finalRide.availableSeats,
    0,
    "The available seat count should be zero"
  );

  console.log("Atomic reservation assertions passed");
}

// ==================================================
// 9. Experiment 3: Transaction rollback
// ==================================================

async function testTransactionRollback(): Promise<void> {
  const ride = await Ride.create({
    availableSeats: INITIAL_SEATS,
  });

  await assert.rejects(
    transactionalBookSeat(
      ride._id,
      "rollback-passenger",
      true
    ),
    /Simulated booking failure/
  );

  const finalRide = await Ride.findById(ride._id);

  const bookingCount = await Booking.countDocuments({
    rideId: ride._id,
  });

  assert.ok(finalRide, "Rollback test ride must exist");

  assert.equal(
    finalRide.availableSeats,
    INITIAL_SEATS,
    "Aborted transaction must restore the seat"
  );

  assert.equal(
    bookingCount,
    0,
    "Aborted transaction must leave zero bookings"
  );

  console.log("\nTransaction rollback experiment:");
  console.log("Remaining seats:", finalRide.availableSeats);
  console.log("Booking records:", bookingCount);
  console.log("Transaction rollback assertions passed");
}

// ==================================================
// 10. Experiment 4: Concurrent transactions
// ==================================================

async function testConcurrentTransactions(): Promise<void> {
  const ride = await Ride.create({
    availableSeats: INITIAL_SEATS,
  });

  const results = await Promise.allSettled(
    Array.from(
      { length: CONCURRENT_PASSENGERS },
      (_, index) =>
        transactionalBookSeat(
          ride._id,
          `transaction-passenger-${index + 1}`
        )
    )
  );

  const fulfilledAttempts = results.filter(
    (result) => result.status === "fulfilled"
  ).length;

  const successfulRequests = results.filter(
    (result) =>
      result.status === "fulfilled" &&
      result.value === true
  ).length;

  const rejectedAttempts = results.filter(
    (result) => result.status === "rejected"
  );

  const bookingCount = await Booking.countDocuments({
    rideId: ride._id,
  });

  const finalRide = await Ride.findById(ride._id);

  assert.ok(
    finalRide,
    "Concurrent transaction ride must exist"
  );

  console.log("\nConcurrent transaction experiment:");
  console.log("Total attempts:", CONCURRENT_PASSENGERS);
  console.log("Fulfilled attempts:", fulfilledAttempts);
  console.log("Successful bookings:", successfulRequests);
  console.log("Rejected attempts:", rejectedAttempts.length);
  console.log("Booking records:", bookingCount);
  console.log("Remaining seats:", finalRide.availableSeats);

  // Database consistency must hold regardless
  // of transient transaction errors.
  assert.ok(
    bookingCount <= INITIAL_SEATS,
    "Confirmed bookings must never exceed capacity"
  );

  assert.equal(
    finalRide.availableSeats + bookingCount,
    INITIAL_SEATS,
    "Available seats plus bookings must equal capacity"
  );

  assert.equal(
    successfulRequests,
    bookingCount,
    "Successful requests must match booking records"
  );

  console.log("Concurrent transaction invariants passed");
}

// ==================================================
// 11. Experiment 5: Duplicate booking prevention
// ==================================================

async function testDuplicateBooking(): Promise<void> {
  const ride = await Ride.create({
    availableSeats: 2,
  });

  const results = await Promise.allSettled([
    transactionalBookSeat(
      ride._id,
      "same-passenger"
    ),
    transactionalBookSeat(
      ride._id,
      "same-passenger"
    ),
  ]);

  const successfulRequests = results.filter(
    (result) =>
      result.status === "fulfilled" &&
      result.value === true
  ).length;

  const rejectedAttempts = results.filter(
    (result) => result.status === "rejected"
  );

  const bookingCount = await Booking.countDocuments({
    rideId: ride._id,
    passengerId: "same-passenger",
  });

  const finalRide = await Ride.findById(ride._id);

  assert.ok(finalRide, "Duplicate test ride must exist");

  console.log("\nDuplicate booking experiment:");
  console.log("Successful requests:", successfulRequests);
  console.log("Rejected attempts:", rejectedAttempts.length);
  console.log("Duplicate booking records:", bookingCount);
  console.log("Remaining seats:", finalRide.availableSeats);

  // These invariants must hold whether the second
  // request fails with E11000 or a transaction conflict.
  assert.equal(
    bookingCount,
    1,
    "Only one booking may exist for the passenger"
  );

  assert.equal(
    finalRide.availableSeats,
    1,
    "The duplicate must not consume another seat"
  );

  // Inspect rejected errors without assuming that
  // every concurrent run produces the same error.
  for (const result of rejectedAttempts) {
    if (result.status === "rejected") {
      const error = result.reason;

      if (
        error instanceof Error &&
        "code" in error &&
        error.code === 11000
      ) {
        console.log("MongoDB duplicate-key error: E11000");
      } else {
        console.log(
          "Rejected transaction:",
          error instanceof Error
            ? error.message
            : String(error)
        );
      }
    }
  }

  console.log("Duplicate booking prevention assertions passed");
}

// ==================================================
// 12. Main experiment runner
// ==================================================

async function main(): Promise<void> {
  assert.ok(
    process.env.MONGO_URI,
    "MONGO_URI must be defined"
  );

  // Avoid accidentally clearing a non-local database.
  const mongoUri = process.env.MONGO_URI;

  const url = new URL(mongoUri);
  const hosts = url.host.split(",");

  assert.ok(
    hosts.length === 1 &&
      ["localhost", "127.0.0.1"].includes(
        hosts[0].split(":")[0]
      ),
    "S4 destructive experiments require a local MongoDB URI"
  );

  await mongoose.connect(mongoUri);

  try {
    console.log("Connected to MongoDB");
    console.log("S4 — Concurrent Booking Consistency");
    console.log(
      "Concurrent passengers:",
      CONCURRENT_PASSENGERS
    );
    console.log("Initial available seats:", INITIAL_SEATS);

    await prepareDatabase();

    await testUnsafeBooking();
    await testAtomicBooking();
    await testTransactionRollback();
    await testConcurrentTransactions();
    await testDuplicateBooking();

    console.log("\nAll S4 experiments completed.");
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
