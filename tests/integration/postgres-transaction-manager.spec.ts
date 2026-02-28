import test from "node:test";

test("Postgres transaction manager rollback integration skeleton", { skip: true }, async () => {
	// Arrange: boot Postgres test database and resolve PostgresTransactionManagerAdapter
	// Act: runInTransaction with a write operation that throws after insert/update
	// Assert: data is rolled back and no partial state remains
});
