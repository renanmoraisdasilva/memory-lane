import type { VideoProxyPrepareParams, VideoProxyState } from "../features/library/types";

function failedState(fileId: number): VideoProxyState {
  return {
    fileId,
    status: "failed",
    progress: null,
    mediaUrl: null,
    errorMessage: "Compatible playback is not available in this fixture.",
  };
}

export function videoProxyFixtureMethods(): {
  getVideoProxyState: (params: { fileId: number }) => Promise<VideoProxyState>;
  prepareVideoProxy: (params: VideoProxyPrepareParams) => Promise<VideoProxyState>;
} {
  return {
    getVideoProxyState: (params) => Promise.resolve(failedState(params.fileId)),
    prepareVideoProxy: (params) => Promise.resolve(failedState(params.fileId)),
  };
}
