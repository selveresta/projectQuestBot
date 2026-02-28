import { Global, Module } from "@nestjs/common";

import { POSTGRES_DB } from "./postgres.constants";
import { PostgresBootstrapService } from "./postgres-bootstrap.service";
import { PostgresClientLifecycleService } from "./postgres-client-lifecycle.service";
import { PostgresExecutionContextService } from "./postgres-execution-context.service";
import { postgresDatabaseProvider } from "./postgres.provider";

@Global()
@Module({
	providers: [postgresDatabaseProvider, PostgresBootstrapService, PostgresClientLifecycleService, PostgresExecutionContextService],
	exports: [POSTGRES_DB, PostgresExecutionContextService],
})
export class PostgresKyselyModule {}

export { PostgresKyselyModule as PostgresModule };
