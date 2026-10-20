# ADR-0001: MongoDB Transaction Semantics

**Date:** 2026-10-19  
**Status:** Proposed

## 1. Question

Can MongoDB 7 transactions reliably commit and roll back multiple document writes, and what happens when a Mongoose operation omits its transaction session?

## 2. Environment

- Operating system: Windows with WSL 2
- Database: MongoDB 7.0.45 (`mongo:7` Docker image)
- Deployment: Single-node replica set (`rs0`)
- ODM: Mongoose
- Experiment: `spikes/s1-transaction.ts`
- Mongoose version: 9.11.2
- Docker Engine: 29.8.2
- Docker Compose: 5.6.0
## 3. Experiment

Three scenarios were tested:

1. Insert two documents inside a transaction and deliberately throw an error.
2. Insert two documents inside a transaction and allow it to commit.
3. Repeat the rollback experiment without passing the MongoDB session to the document inserts.

The environment was additionally checked after a container restart and fresh Docker-volume initialization.
## 4. Observed Results

### Experiment A — Transaction rollback

With the MongoDB session explicitly passed to both inserts:

```text
Connected to MongoDB
Verified intentional rollback
Documents after rollback: 0
Documents after commit: 2
```

**Observation:** Both inserted documents were rolled back after the intentional error. The subsequent successful transaction committed two documents.

### Experiment B — Missing transaction session

After deliberately removing the session option from the inserts:

```text
Connected to MongoDB
Verified intentional rollback
Documents after rollback: 2
Documents after commit: 4
```

**Observation:** The first two documents survived because their inserts executed outside the transaction. Aborting the transaction did not undo those writes.

### Experiment C — Replica-set restart

After restarting the MongoDB container:

```text
poolr-mongo-1   mongo:7   Up 35 seconds (healthy)
```

The transaction script was rerun and produced the expected rollback and commit counts.

### Experiment D — Clean-volume initialization

After removing the Docker-managed data volume and recreating the MongoDB container:

```text
poolr-mongo-1   mongo:7   Up 22 seconds (healthy)
```

The replica-set status command returned:

```text
1
```

State `1` confirms the node was PRIMARY.

The transaction script was executed again:

```text
Connected to MongoDB
Verified intentional rollback
Documents after rollback: 0
Documents after commit: 2
```

**Observation:** The replica set initialized successfully from a fresh volume, and transaction behavior remained consistent.
### Experiment E — Mongoose multi-document insertion

During the initial transaction experiment, Mongoose 9.11.2 produced this error:

```
MongooseError: Cannot call `create()` with a session and multiple documents unless `ordered: true` is set
```

The original operation was:

```typescript
await Item.create([{ n: 1 }, { n: 2 }], { session });
```

The corrected operation was:

```typescript
await Item.create(
  [{ n: 1 }, { n: 2 }],
  { session, ordered: true }
);
```

**Observation:** The initial rollback test reported zero remaining documents, but the insertion had failed before the intentional rollback error was reached. Therefore, that initial result was not valid evidence of transaction rollback.

After correcting the insertion options and verifying that the caught error was specifically `Intentional rollback`, the experiment produced the expected result of zero documents after rollback.

**Engineering lesson:** Tests must verify that the intended operation was actually executed. An expected final value alone does not establish correctness.
## 5. Decision

Poolr will use MongoDB multi-document transactions for operations that must update multiple documents atomically.

Transactional repository methods must require an explicit MongoDB `ClientSession` argument.

Services will own transaction boundaries, while repositories will execute database operations using the session supplied by the service.

A shared `runInTransaction` helper will centralize transaction lifecycle management.

The helper must not silently retry operations indefinitely. Booking operations will follow the specification's five-second deadline and uncertain-commit handling requirements.

## 6. Consequences

### Benefits

- Related database writes can commit or roll back atomically.
- Explicit session arguments make transaction participation visible in repository method signatures.
- Centralized transaction management reduces duplicated transaction-handling code.
- Services can coordinate atomic operations across multiple repositories.

### Risks and limitations

- Omitting a session can cause a write to execute outside the intended transaction.
- Transactions do not automatically prevent every concurrency problem; conditional updates, unique indexes, and invariant checks remain necessary.
- MongoDB transaction callbacks may execute multiple times during retries, so callbacks must not perform irreversible external side effects.
- A timeout or connection failure during commit can leave the transaction outcome uncertain.
- A single-node replica set supports transaction experiments but does not provide high availability.

## 7. Conclusion

The S1 experiments support the decision to use MongoDB transactions with explicit session propagation for Poolr's multi-document booking operations.

Rollback, commit, missing-session behavior, restart recovery, and clean-volume initialization were tested.

These findings establish the transaction baseline. They do not yet establish booking concurrency correctness, which will be investigated in S4 and v0.3.
