import { logger } from "@/bootstrap/logger";
import { startGrpcServer } from "@/rpc/init";

logger.info("Starting mini-defi-server (BSC)...");
startGrpcServer();
