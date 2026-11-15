import type { ClubEvent, SiteContent } from "#shared/types";

function eventPreview(event: ClubEvent): ClubEvent {
  return {
    slug: event.slug,
    title: event.title,
    category: event.category,
    start: event.start,
    end: event.end,
    location: event.location,
    eventState: event.eventState,
    allDay: event.allDay,
    startDate: event.startDate,
    endDate: event.endDate,
    summary: "",
    body: "",
    image: "",
  };
}

// Only this projection is serialized into the home page's hydration payload.
export function homeContent(content: SiteContent, now = new Date()) {
  return {
    activities: content.activities.map((activity) => ({
      slug: activity.slug,
      title: activity.title,
      eyebrow: activity.eyebrow,
      summary: activity.summary,
      image: activity.image,
      imageAlt: activity.imageAlt,
      imagePosition: activity.imagePosition,
      audience: activity.audience,
      tag: activity.tag,
      order: activity.order,
      body: "",
    })),
    events: content.events
      .filter((event) => new Date(event.end) >= now)
      .slice(0, 3)
      .map(eventPreview),
    publications: [...content.publications]
      .filter((publication) => publication.photoCount >= 2)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .slice(0, 3)
      .map((publication) => ({
        slug: publication.slug,
        title: publication.title,
        category: publication.category,
        summary: publication.summary,
        date: publication.date,
        image: publication.image,
        imageAlt: publication.imageAlt,
        imagePosition: publication.imagePosition,
        photoCount: publication.photoCount,
        meeting: publication.meeting ? eventPreview(publication.meeting) : null,
      })),
  };
}
