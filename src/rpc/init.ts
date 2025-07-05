import GrpcServer from "@/rpc/server";
import { GRPC_HOST, GRPC_PORT } from "@/bootstrap/env";
import { executeSwap } from "@/protocols/pancake/executeSwap";
import {
  SwapServiceService,
  type SwapServiceServer,
} from "@/generated/pancake";
import { buildUnsignedTx, submitSignedTx } from "./services/TxService";
import {
  TransactionServiceService,
  type TransactionServiceServer,
} from "@/generated/transaction";

export function startGrpcServer() {
  const server = new GrpcServer();

  const pancakeHandlers: SwapServiceServer = {
    executeSwap,
  };
  server.addService(SwapServiceService, pancakeHandlers);

  const txHandlers: TransactionServiceServer = {
    buildUnsignedTx,
    submitSignedTx,
  };
  server.addService(TransactionServiceService, txHandlers);

  server.start(GRPC_HOST, GRPC_PORT);
}
