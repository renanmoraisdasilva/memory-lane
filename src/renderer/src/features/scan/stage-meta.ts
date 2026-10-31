import { FileText, Fingerprint, FolderSearch, Image } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ScanStageId } from "./types";

export const STAGE_ICONS: Record<ScanStageId, LucideIcon> = {
  catalog: FolderSearch,
  metadata: FileText,
  thumbnails: Image,
  hashes: Fingerprint,
};
