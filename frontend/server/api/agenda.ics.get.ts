import { eventIsInMonth } from "#shared/dates";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const month = typeof query.mois === "string" ? query.mois : "";
  if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
    throw createError({ statusCode: 400, statusMessage: "Mois invalide" });
  const data = await fetchClubContent();
  const events = data.events.filter(
    (e) =>
      (!month || eventIsInMonth(e, month)) &&
      (!query.categorie || e.category === query.categorie) &&
      (!query.evenement || (e.slug === query.evenement || e.legacySlug === query.evenement)) &&
      (!query.tag || e.tags?.includes(String(query.tag))),
  );
  if (query.evenement && !events.length)
    throw createError({
      statusCode: 404,
      statusMessage: "Événement introuvable",
    });
  setHeader(event, "Content-Type", "text/calendar; charset=utf-8");
  setHeader(
    event,
    "Content-Disposition",
    'attachment; filename="vertical-cotiere.ics"',
  );
  setHeader(event, "Cache-Control", "public, max-age=60");
  return createCalendar(events, getRequestURL(event).origin);
});
