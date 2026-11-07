export default defineEventHandler(async () => {
  try { return await fetchClubContent(); }
  catch { throw createError({statusCode:503,statusMessage:'Les contenus sont momentanément indisponibles. Merci de réessayer.'}); }
});
