import type { ClubEvent } from "../../shared/types.ts";

export function escapeIcal(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}
export function foldIcalLine(value: string) {
  const lines: string[] = [];
  let line = "";
  for (const character of value) {
    if (new TextEncoder().encode(line + character).length > 75) {
      lines.push(line);
      line = " ";
    }
    line += character;
  }
  lines.push(line);
  return lines.join("\r\n");
}
const timestamp = (value: string) =>
  new Date(value)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
export function createCalendar(
  events: ClubEvent[],
  origin: string,
  now = new Date(),
) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Vertical Cotiere//Agenda du club//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Vertical Côtière",
    "X-WR-TIMEZONE:Europe/Paris",
  ];
  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeIcal(event.calendarUid || `${event.slug}@vertical-cotiere`)}`,
      `DTSTAMP:${timestamp(now.toISOString())}`,
      `LAST-MODIFIED:${timestamp(event.updatedAt || now.toISOString())}`,
    );
    if (event.allDay && event.startDate && event.endDate) {
      lines.push(
        `DTSTART;VALUE=DATE:${event.startDate.replace(/-/g, "")}`,
        `DTEND;VALUE=DATE:${event.endDate.replace(/-/g, "")}`,
      );
    } else {
      lines.push(`DTSTART:${timestamp(event.start)}`);
      if (new Date(event.end) > new Date(event.start))
        lines.push(`DTEND:${timestamp(event.end)}`);
    }
    lines.push(
      `SUMMARY:${escapeIcal(event.title)}`,
      `DESCRIPTION:${escapeIcal(event.body || event.summary)}`,
      `LOCATION:${escapeIcal(event.location)}`,
      `URL:${origin}/vie-du-club/${encodeURIComponent(event.slug)}`,
      `CATEGORIES:${escapeIcal(event.category)}`,
      `STATUS:${event.eventState === "annulé" ? "CANCELLED" : "CONFIRMED"}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldIcalLine).join("\r\n") + "\r\n";
}
