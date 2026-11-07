import type { PhotoAlbum } from "#shared/gallery";
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const slug = getRouterParam(event, "slug");
  try {
    return await $fetch<PhotoAlbum>(
      `${config.cmsUrl}/api/gallery/${encodeURIComponent(slug || "")}`,
      { timeout: 10000 },
    );
  } catch (error) {
    const status = (error as { response?: { status?: number } }).response
      ?.status;
    throw createError({
      statusCode: status === 404 ? 404 : 503,
      statusMessage:
        status === 404
          ? "Album introuvable"
          : "Galerie momentanément indisponible",
    });
  }
});
