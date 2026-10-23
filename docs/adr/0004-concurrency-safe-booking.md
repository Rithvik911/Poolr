
# ADR-0004: Concurrency-Safe Seat Booking

**Status:** Proposed

## Context

Poolr must prevent multiple passengers from reserving more seats than a driver has available.

Concurrent booking requests introduce race conditions when separate operations read seat availability, create booking records, and update remaining capacity.

The booking workflow must preserve consistency between ride availability and confirmed booking records, even when an operation fails.

Repeated requests from the same passenger can also create duplicate bookings unless uniqueness is enforced.

## Decision

Use a conditional atomic update inside a MongoDB transaction to reserve seats and create booking records.

The seat reservation must check that available capacity is greater than zero and decrement it atomically:

`availableSeats > 0` followed by `$inc: { availableSeats: -1 }`

Both the seat decrement and booking creation must participate in the same MongoDB transaction session.

Enforce a compound unique index on `(rideId, passengerId)` to prevent duplicate booking records for the same passenger and ride.

The proposed production implementation must also define explicit policies for transaction retries, API idempotency, cancellation, and ambiguous commit outcomes.

## Alternatives Considered

### Read-then-write reservation

Read the available seat count, create a booking, and update the previously observed count.

This approach is rejected because concurrent requests can read the same available capacity and create more bookings than available seats.

### Atomic update without a transaction

Use a conditional atomic update to decrement available seats before creating a booking.

This prevents competing requests from reserving the same final seat.

However, if booking creation fails after the decrement, the ride may permanently lose a seat without a corresponding booking.

### Transaction without uniqueness enforcement

Perform the conditional seat decrement and booking insert inside a transaction.

This protects consistency between the two operations but does not independently prevent the same passenger from booking a ride multiple times.

## Experimental Evidence

Implemented a reproducible TypeScript experiment in `spikes/s4-concurrent-booking.ts`.

The experiment used MongoDB 7 in a local Docker single-node replica set, Mongoose 9.11.2, and isolated experimental collections.

Five scenarios were evaluated.

| Experiment | Observed result |
|---|---|
| Unsafe concurrent booking | 50 booking records for 1 available seat |
| Atomic conditional reservation | 1 booking record, 0 remaining seats |
| Transaction rollback after injected failure | 0 booking records, original seat restored |
| 50 concurrent transactional attempts | 1 successful booking, 1 booking record, 0 remaining seats |
| Duplicate booking requests | 1 booking record, 1 remaining seat, duplicate-key error E11000 |

All assertions passed in the recorded execution.

The TypeScript experiment also passed type checking.

The observed results do not establish guaranteed behavior under every possible concurrency schedule or failure mode.

## Consistency Invariants

The proposed booking service must maintain:

- Confirmed bookings must not exceed ride capacity.
- Remaining seats must never be negative.
- Remaining seats plus active seat reservations must agree with the configured capacity.
- A failed transaction must not leave a partial seat reservation or booking record.
- A passenger must not have duplicate active bookings for the same ride.
- Successfully reported bookings must correspond to committed database records.

These invariants must be verified through production integration tests, including cancellation and retry scenarios.

## Consequences

### Benefits

- Conditional atomic updates prevent overbooking of the last available seat.
- Transactions coordinate seat reservation and booking creation across collections.
- Transaction rollback prevents partial booking state following an injected failure.
- A compound unique index provides database-enforced duplicate prevention.
- Database invariants can be checked using repeatable concurrent tests.

### Limitations

- Transactions can encounter write conflicts and transient errors under contention.
- Transaction retry behavior requires further testing.
- An ambiguous commit outcome requires careful handling before reporting booking success or failure.
- A unique passenger-ride index is not equivalent to request idempotency.
- A permanent uniqueness constraint may conflict with future cancellation and rebooking requirements.
- Transactions introduce additional database work compared with single-document atomic updates.
- The experiment used synthetic concurrent requests against local MongoDB.
- Process crashes, network failures, and production-scale performance have not been evaluated.

## Follow-up

- Design explicit retry and idempotency handling for the production booking API.
- Define booking states and cancellation/rebooking behavior.
- Add integration tests for duplicate requests and transaction conflicts.
- Investigate injected booking-write failures and ambiguous commit outcomes.
- Evaluate concurrency performance under realistic workloads.
- Implement and review the production booking service during v0.3.

## References

- `spikes/s4-concurrent-booking.ts`
- `docs/LOG.md`
- `docs/adr/0001-transactions.md`
