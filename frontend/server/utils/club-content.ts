import sanitizeHtml from "sanitize-html";
import report from "../../../content/import-report.json";
import type { SiteContent } from "#shared/types";

const redirects = { ...report.redirects, ...report.assetRedirects } as Record<
  string,
  string
>;
export function cleanImportedHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      "img",
      "figure",
      "figcaption",
      "details",
      "summary",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "loading"],
      "*": ["id"],
      th: ["colspan", "rowspan"],
      td: ["colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel", "webcal"],
    transformTags: {
      a: (
        _tag,
        attrs,
      ): { tagName: string; attribs: Record<string, string> } => {
        try {
          const url = new URL(attrs.href || "", "https://local.invalid");
          if (
            ["vertical-cotiere.fr", "www.vertical-cotiere.fr"].includes(
              url.hostname,
            )
          ) {
            const path =
              decodeURIComponent(url.pathname).replace(/\/$/, "") || "/";
            const target = redirects[path];
            if (!target) return { tagName: "span", attribs: {} };
            return { tagName: "a", attribs: { href: target } };
          }
        } catch {
          return { tagName: "span", attribs: {} };
        }
        return {
          tagName: "a",
          attribs: { ...attrs, rel: "noopener noreferrer" },
        };
      },
    },
  });
}
export async function fetchClubContent(): Promise<SiteContent> {
  const config = useRuntimeConfig();
  const data = await $fetch<SiteContent>(`${config.cmsUrl}/api/site-content`, {
    timeout: 10000,
  });
  for (const item of [...data.pages, ...data.events]) {
    if (item.bodyHtml) item.bodyHtml = cleanImportedHtml(item.bodyHtml);
  }
  return data;
}
