export interface PageEntry {
  title: string;
  urlPath: string;
  htmlContent: string;
  headHtml?: string;
  isProtected: boolean;
  allowedEmails: string[];
}

export function normalizePath(path: string): string {
  return path.replace(/^\/+|\/+$/g, "");
}

export function findPageForRequestPath(
  pages: PageEntry[],
  requestedPath: string
): PageEntry | undefined {
  return pages.find((entry) => normalizePath(entry.urlPath) === requestedPath);
}
