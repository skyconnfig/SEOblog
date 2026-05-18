/** Format date for blog posts */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

/** Slugify a string */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w一-龥]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Clamp number between min and max */
export function clamp(num: number, min: number, max: number): number {
  return Math.min(Math.max(num, min), max);
}
