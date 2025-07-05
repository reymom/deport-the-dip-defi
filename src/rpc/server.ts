import grpc from "@grpc/grpc-js";

import { logger } from "@/bootstrap/logger";

export default class GrpcServer {
  private server: grpc.Server = new grpc.Server();

  addService<T extends grpc.UntypedServiceImplementation>(
    protoService: grpc.ServiceDefinition<T>,
    serviceImpl: T
  ) {
    this.server.addService(protoService, serviceImpl);
  }
  async start(host: string, port: string | number) {
    if ((globalThis as any).grpcServer) {
      (globalThis as any).grpcServer.forceShutdown();
    }
    this.server.bindAsync(
      `${host}:${port}`,
      grpc.ServerCredentials.createInsecure(),
      (err, actualPort) => {
        if (err != null) {
          return console.error(err);
        }

        logger.info(`🌐 gRPC listening on ${host}:${actualPort}`);

        (globalThis as any).grpcServer = this.server;
      }
    );
  }
}
