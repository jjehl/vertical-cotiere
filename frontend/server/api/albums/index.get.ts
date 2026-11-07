import type { AlbumSummary } from "#shared/gallery";
export default defineEventHandler(async () => {
  const config = useRuntimeConfig();
  return await $fetch<AlbumSummary[]>(`${config.cmsUrl}/api/gallery`, {
    timeout: 10000,
  });
});
