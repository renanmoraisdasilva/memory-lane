import { useEffect, useState } from "react";
import { useLibraryClient } from "./library-client-context";
import type { VideoProxyState } from "./types";

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useVideoProxy(
  fileId: number,
  active: boolean,
  retryKey: number,
): VideoProxyState | null {
  const client = useLibraryClient();
  const [state, setState] = useState<VideoProxyState | null>(null);

  useEffect(() => {
    if (!active) {
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function poll(): Promise<void> {
      try {
        const next = await client.getVideoProxyState({ fileId });
        if (cancelled) {
          return;
        }
        setState(next);
        if (next.status !== "processing" && timer !== null) {
          clearInterval(timer);
          timer = null;
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            fileId,
            status: "failed",
            progress: null,
            mediaUrl: null,
            errorMessage: messageFrom(error),
          });
        }
        if (timer !== null) {
          clearInterval(timer);
          timer = null;
        }
      }
    }

    void (async () => {
      try {
        const first = await client.prepareVideoProxy({
          fileId,
          ...(retryKey > 0 ? { retry: true } : {}),
        });
        if (cancelled) {
          return;
        }
        setState(first);
        if (first.status === "processing" || first.status === "idle") {
          timer = setInterval(() => {
            void poll();
          }, 750);
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            fileId,
            status: "failed",
            progress: null,
            mediaUrl: null,
            errorMessage: messageFrom(error),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
      if (timer !== null) {
        clearInterval(timer);
      }
    };
  }, [active, client, fileId, retryKey]);

  return state;
}
