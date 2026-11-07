import type { ClubEvent } from "./types.ts";

export const timeZone = "Europe/Paris";
export function dateLabel(
  value: string,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
  },
) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone, ...options }).format(
    new Date(value),
  );
}
export function canParticipate(event: ClubEvent, now = new Date()) {
  return (
    event.eventState === "prévu" &&
    !!event.participationUrl &&
    new Date(event.deadline || event.end) > now
  );
}
export function parisDay(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
export function eventDayRange(event: ClubEvent): [string, string] {
  const start =
    event.allDay && event.startDate ? event.startDate : parisDay(event.start);
  const last =
    event.allDay && event.endDate
      ? new Date(new Date(event.endDate + "T12:00:00Z").getTime() - 86400000)
          .toISOString()
          .slice(0, 10)
      : parisDay(
          new Date(
            Math.max(
              new Date(event.start).getTime(),
              new Date(event.end).getTime() - 1,
            ),
          ).toISOString(),
        );
  return [start, last];
}
export function eventIsOnDay(event: ClubEvent, day: string) {
  const [start, last] = eventDayRange(event);
  return start <= day && last >= day;
}
export function eventIsInMonth(event: ClubEvent, month: string) {
  const [start, last] = eventDayRange(event);
  return start.slice(0, 7) <= month && last.slice(0, 7) >= month;
}
export function eventDateLabel(event: ClubEvent) {
  const [start, last] = eventDayRange(event);
  const first = dateLabel(start + "T12:00:00Z");
  return start === last
    ? first
    : `${first} – ${dateLabel(last + "T12:00:00Z")}`;
}
