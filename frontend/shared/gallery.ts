export interface AlbumPhoto {
  id: number;
  legacyId?: number;
  title: string;
  src: string;
  thumb: string;
  width: number;
  height: number;
}
export interface AlbumSummary {
  slug: string;
  title: string;
  description: string;
  cover: string;
  count: number;
  sourceId: string;
  parentId?: string;
}
export interface PhotoAlbum {
  slug: string;
  title: string;
  description: string;
  photos: AlbumPhoto[];
}
