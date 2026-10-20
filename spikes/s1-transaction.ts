
import 'dotenv/config';
import mongoose from 'mongoose';
import assert from 'node:assert/strict';

async function main() {
    // Step 1: Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI!);
    console.log('Connected to MongoDB');

    // Step 2: Define the test model
    const Item = mongoose.model(
        'SpikeItem',
        new mongoose.Schema({ n: Number })
    );

    // Step 3: Prepare an empty collection
    await Item.createCollection();
    await Item.deleteMany({});

    // Step 4: Test transaction rollback
    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {
            await Item.create(
                [{ n: 1 }, { n: 2 }],
                { session, ordered: true }
            );

            // Deliberately abort the transaction
            throw new Error('Intentional rollback');
        });
    } catch (error) {
        if (
            error instanceof Error &&
            error.message === 'Intentional rollback'
        ) {
            console.log('Verified intentional rollback');
        } else {
            throw error;
        }
    } finally {
        await session.endSession();
    }

    // Step 5: Assert rollback removed both documents
    const countAfterRollback = await Item.countDocuments();

    assert.equal(
        countAfterRollback,
        0,
        'Rollback must leave zero documents'
    );

    console.log(
        'Documents after rollback:',
        countAfterRollback
    );

    // Step 6: Test successful transaction commit
    const commitSession = await mongoose.startSession();

    try {
        await commitSession.withTransaction(async () => {
            await Item.create(
                [{ n: 3 }, { n: 4 }],
                { session: commitSession, ordered: true }
            );
        });
    } finally {
        await commitSession.endSession();
    }

    // Step 7: Assert both documents were committed
    const countAfterCommit = await Item.countDocuments();

    assert.equal(
        countAfterCommit,
        2,
        'Successful transaction must commit exactly two documents'
    );

    console.log(
        'Documents after commit:',
        countAfterCommit
    );

    // Step 8: Disconnect
    await mongoose.disconnect();
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
    