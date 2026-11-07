import report from "../../../content/import-report.json";
import galleryRedirects from "../../../content/gallery-redirects.json";

const redirects = {
  ...report.redirects,
  ...report.assetRedirects,
  ...galleryRedirects.files,
} as Record<string, string>;
export default defineEventHandler(async (event) => {
  const url = getRequestURL(event);
  let path: string;
  try {
    path = decodeURIComponent(url.pathname).replace(/\/+$/, "") || "/";
  } catch {
    return;
  }
  if (path === "/api/agenda.ics") return;
  if(path.startsWith('/imports/')) {
    const config=useRuntimeConfig();
    try {
      const file=await $fetch<{url:string}>(`${config.cmsUrl}/api/legacy-assets/${encodeURIComponent(path.slice('/imports/'.length))}`,{timeout:10000});
      return sendRedirect(event,file.url,302);
    } catch {throw createError({statusCode:404,statusMessage:'Fichier introuvable'});}
  }
  if (path === '/partenaires') return;
  if (path === '/ressources/partenaires') return sendRedirect(event, '/partenaires', 301);
  if (path === "/albums/index.php" || path === "/albums/picture.php") {
    const query = decodeURIComponent(url.search);
    const category = query.match(/category\/(\d+)/)?.[1];
    const photo = path.endsWith("/picture.php")
      ? query.match(/^\?\/(\d+)/)?.[1]
      : undefined;
    const album = category
      ? (galleryRedirects.categories as Record<string, string>)[category]
      : photo
        ? (galleryRedirects.photos as Record<string, string>)[photo]
        : undefined;
    return sendRedirect(
      event,
      album ? `/albums/${album}` + (photo ? `?legacyPhoto=${photo}` : "") : "/albums",
      301,
    );
  }
  if (url.searchParams.get("ical") === "1")
    return sendRedirect(event, "/api/agenda.ics", 301);
  const target = redirects[path];
  if (target && target !== path && target !== url.pathname)
    return sendRedirect(event, target, 301);
  if (/^\/(?:index\.php\/)?(?:events|evenements)(?:\/|$)/.test(path)) {
    const params = new URLSearchParams();
    const date = path.match(/(\d{4}-\d{2})(?:-(\d{2}))?/);
    if (date) params.set("mois", date[1]!);
    if (date?.[2]) {
      params.set("jour", `${date[1]}-${date[2]}`);
      params.set("vue", "jour");
    } else if (path.includes("/mois")) params.set("vue", "mois");
    if (path.includes("competition")) params.set("categorie", "Compétition");
    else if (path.includes("sorties")) params.set("categorie", "Sortie");
    else if (path.includes("baby-escalade")) params.set("categorie", "Cours");
    else if (path.includes("stages")) params.set("categorie", "Stage");
    return sendRedirect(
      event,
      "/agenda" + (params.size ? "?" + params.toString() : ""),
      301,
    );
  }
  if (/^\/(category|tag|author)\//.test(path))
    return sendRedirect(event, "/actualites", 301);
  const oldId = url.searchParams.get("p") || url.searchParams.get("page_id");
  const idTarget =
    oldId && (report.idRedirects as Record<string, string>)[oldId];
  if (idTarget) return sendRedirect(event, idTarget, 301);
});
