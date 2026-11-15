export interface MemberProfile {
  id:number; email:string; firstName:string; lastName:string; phone:string; street:string;
  postalCode:string; city:string; country:string; ffmeLicenseNumber:string;
  role:'basic'|'contributor';
}
export interface MemberPublication {documentId:string;title:string;updatedAt:string;published:boolean}
export interface MemberPhoto {id:number;name:string;url:string}
export interface AssistantPublication {
  title:string;body:string;category:string;photos?:number[];
  meeting:null|{start:string;end?:string|null;deadline?:string|null;location?:string|null;participationUrl?:string|null;participationLabel?:string|null;allDay:boolean;eventState:string};
}
export interface MemberPreview {previewId:string;data:AssistantPublication;original:AssistantPublication|null;canPublish:boolean}
export interface MemberSource {documentId:string;version:string;data:AssistantPublication;photos:MemberPhoto[];published:boolean}
