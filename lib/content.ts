import rally from "@/content/rally.json";

/** Every string on the Rally page. Safe to import from server and client modules. */
export const content = rally;

/**
 * Replaces each `{name}` in `template` with `String(values[name])`.
 * A placeholder with no matching own key is left as written.
 */
export function fill(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{([^{}]+)\}/g, (placeholder, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : placeholder,
  );
}
