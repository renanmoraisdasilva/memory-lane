import { protocol } from "electron";
import { handleMediaRequest, type MediaRequestDependencies } from "./media-request-handler";

export type MediaProtocolDependencies = MediaRequestDependencies;

export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: "ml-media",
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
      },
    },
  ]);
}

export function registerMediaProtocol(dependencies: MediaProtocolDependencies): void {
  protocol.handle("ml-media", (request) =>
    handleMediaRequest(dependencies, request).catch((error: unknown) => {
      dependencies.logger.error("Media protocol request failed", error);
      return new Response(null, { status: 500 });
    }),
  );
}
