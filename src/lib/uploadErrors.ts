export type UploadErrorCode =
  | "INVALID_BODY"
  | "MISSING_FILE_URL"
  | "MISSING_WORKSPACE_ID"
  | "DOWNLOAD_FAILED"
  | "INVALID_ZIP"
  | "MISSING_INDEX_HTML"
  | "EXTRACTION_FAILED"
  | "ANALYSIS_FAILED"
  | "DEPLOY_FAILED"
  | "UNKNOWN";

export type UploadErrorResponse = {
  ok: false;
  errorCode: UploadErrorCode;
  message: string;
  details?: unknown;
};

export function makeUploadError(
  errorCode: UploadErrorCode,
  message: string,
  details?: unknown,
): UploadErrorResponse {
  return {
    ok: false,
    errorCode,
    message,
    details,
  };
}
