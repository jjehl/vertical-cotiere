import type { SiteContent } from "#shared/types";

export function useClubContent() {
  return useFetch<SiteContent>("/api/content", {
    key: "club-content",
    default: () => ({ activities: [], events: [], publications: [], pages: [], timetable: null }),
  });
}
