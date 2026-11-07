export interface MediaFile {id:number;name:string;url:string;mime:string;width?:number;height?:number}
export interface Activity {
  imageAlt?: string;
  imagePosition?: string;
  attachments?: MediaFile[];
  slug: string;
  title: string;
  eyebrow: string;
  summary: string;
  body: string;
  image: string;
  audience: string;
  tag: string;
  order: number;
}
export interface ClubEvent {
  attachments?: MediaFile[];
  slug: string;
  title: string;
  category: string;
  summary: string;
  body: string;
  start: string;
  end: string;
  location: string;
  participationUrl?: string;
  participationLabel?: string;
  deadline?: string;
  eventState: "prévu" | "complet" | "annulé" | "reporté";
  image: string;
  bodyHtml?: string;
  allDay?: boolean;
  startDate?: string;
  endDate?: string;
  tags?: string[];
  calendarUid?: string;
  updatedAt?: string;
  legacySlug?: string;
}
export interface PublicationSummary {
  slug:string;
  title:string;
  category:string;
  summary:string;
  date:string|null;
  image:string;
  imageAlt:string;
  imagePosition:string;
  photoCount:number;
  meeting:ClubEvent|null;
}
export interface Publication extends PublicationSummary {
  body:string;
  bodyHtml:string;
  photos:import('./gallery').AlbumPhoto[];
  attachments:MediaFile[];
}
export interface TrainingSlot {
  day: number;
  label: string;
  start: string;
  end: string;
  audience: string;
  birthYears: string;
  capacity?: number | null;
  supervised: boolean;
}
export interface Timetable {
  season: string;
  sessions: TrainingSlot[];
  note: string;
  ufraps: {
    opens: string;
    closes: string;
    day: number;
    start: string;
    end: string;
    closures: { label: string; from: string; until: string }[];
    closedDays: {label:string;date:string}[];
    holidays: string[];
  };
  attachments: {id:number;name:string;url:string;mime:string}[];
}
export interface ClubDocument {title:string;slug:string;category:string;description?:string;format:string;url:string}
export interface ClubPage {
  documents?: ClubDocument[];
  attachments?: MediaFile[];
  slug: string;
  title: string;
  bodyHtml: string;
  group: string;
}
export interface SiteContent {
  activities: Activity[];
  events: ClubEvent[];
  publications: PublicationSummary[];
  pages: ClubPage[];
  timetable: Timetable | null;
}
