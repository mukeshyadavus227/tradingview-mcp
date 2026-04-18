/**
 * Shared MCP response formatting helpers.
 * All tool files should use these instead of hand-crafting MCP responses.
 */
import { classifyError } from '../errors.js';

export function jsonResult(obj, isError = false) {
  return {
    content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }],
    ...(isError && { isError: true }),
  };
}

/**
 * Wrap a core-layer async fn so it always returns a well-formed MCP result.
 * On success, JSON-encodes the return value. On failure, classifies the
 * error into a TvMcpError subclass and emits {success:false, error_code,
 * retryable, hint} so agents can decide whether to retry.
 */
export async function wrapCall(fn) {
  try {
    return jsonResult(await fn());
  } catch (err) {
    const classified = classifyError(err);
    return jsonResult(classified.toJSON(), true);
  }
}
