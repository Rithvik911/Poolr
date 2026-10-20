# Poolr — Development Log

## 2026-10-19 to 2026-10-20 — Gate 0, S1: MongoDB Transactions

**Time spent:** Not recorded

### Work completed

- Installed WSL 2 and configured Docker Desktop.
- Started MongoDB 7.0.45 in Docker as a single-node replica set (`rs0`).
- Verified the MongoDB node reached PRIMARY state.
- Implemented transaction rollback and commit experiments using Mongoose 9.11.2.
- Tested the consequences of omitting a transaction session.
- Verified replica-set recovery after a container restart.
- Verified initialization from a fresh Docker volume.
- Created ADR-0001 documenting the experiments and proposed design decision.

### Measured results

- Rollback with session: 0 documents remained.
- Successful transaction: 2 documents committed.
- Rollback without session: 2 documents survived.
- Replica-set restart: container returned to healthy status.
- Fresh-volume initialization: PRIMARY state `1`.
- Transactions after fresh initialization: rollback 0, commit 2.

### Lessons learned

- MongoDB transactions only protect operations participating in the transaction.
- Explicit session propagation is necessary for Poolr's transactional repository methods.
- Mongoose 9.11.2 required `ordered: true` for the tested multi-document `create()` operation with a session.
- Tests must verify the intended failure, not merely the expected final document count.

### Next

- Review ADR-0001 and progress evidence.
- Update the Gate 0 S1 checklist.
- Commit the verified S1 work.
- Proceed to S2 only after S1 documentation is complete.