/** Vanity-имя для `zrok share --unique-name`: [a-z][a-z0-9-]{3,31}. */
export function toZrokUniqueName(input: string): string | undefined {
  let slug = input
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  if (!slug) return undefined;
  if (/^[0-9]/.test(slug)) slug = `p${slug}`.slice(0, 32);
  if (slug.length < 4) slug = `${slug}-share`.slice(0, 32);
  if (!/^[a-z][a-z0-9-]{3,31}$/.test(slug)) return undefined;
  return slug;
}
