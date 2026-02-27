import { Global, Module } from "@nestjs/common";

import { POSTGRES_POOL } from "./postgres.constants";
import { PostgresBootstrapService } from "./postgres-bootstrap.service";
import { PostgresClientLifecycleService } from "./postgres-client-lifecycle.service";
import { postgresPoolProvider } from "./postgres.provider";

@Global()
@Module({
	providers: [postgresPoolProvider, PostgresBootstrapService, PostgresClientLifecycleService],
	exports: [POSTGRES_POOL],
})
export class PostgresModule {}
