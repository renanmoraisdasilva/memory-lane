export interface HeicPreviewRequest {
  id: number;
  inputPath: string;
  outputPath: string;
}

export type HeicPreviewResponse =
  { id: number; ok: true; bytes: number } | { id: number; ok: false; error: string };
