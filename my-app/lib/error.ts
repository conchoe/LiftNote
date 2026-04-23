/** @supabase/postgrest-js errors are plain objects, not `Error` instances. */
export function errorMessageFromUnknown(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message?: unknown }).message;
    if (m != null && m !== "") return String(m);
  }
  if (e && typeof e === "object" && "code" in e) {
    const c = (e as { code?: string }).code;
    const m = (e as { message?: string }).message;
    if (m) return m;
    if (c) return `Error (code: ${c})`;
  }
  return "Unknown error";
}
