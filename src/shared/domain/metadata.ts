/**
 * Bump this when metadata extraction adds or changes fields.
 *
 * Every successful extraction writes this version to `file_metadata` as
 * `scan.metadataVersion`. Files below the current version are picked up by the
 * next scan and are counted in the library summary so the UI can explain why a
 * refresh is useful.
 */
export const METADATA_EXTRACTOR_VERSION = 2;
