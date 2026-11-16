export interface MemberProfile {
  id:number; username:string; email:string; emailConfirmed:boolean; firstName:string; lastName:string; phone:string; street:string;
  postalCode:string; city:string; country:string; ffmeLicenseNumber:string;
  role:'basic'|'contributor'|'admin';
  hasPassword:boolean;googleConnected:boolean;
}
export interface MemberLoginAccount {
  id:number; username:string; firstName:string; lastName:string;
}
export type MemberLoginResult = {profile:MemberProfile;accounts?:never}|{accounts:MemberLoginAccount[];profile?:never};
export interface MemberParticipationPoll {
  exists:boolean;open:boolean;registered:boolean;
  participants:{name:string;isCurrentMember:boolean}[];
}
export interface ParticipationMember {id:number;name:string;registered:boolean}
export interface ParticipationMemberSearch {members:ParticipationMember[];hasMore:boolean}
export interface MemberPublication {documentId:string;title:string;body:string;category:string;updatedAt:string;published:boolean;url:string|null}
export interface MemberPhoto {id:number;name:string;url:string}
export interface AssistantPublication {
  title:string;body:string;category:string;photos?:number[];
  meeting:null|{start:string;end?:string|null;deadline?:string|null;location?:string|null;participationUrl?:string|null;participationLabel?:string|null;allDay:boolean;eventState:string};
}
export interface MemberPreview {previewId:string;data:AssistantPublication;original:AssistantPublication|null;canPublish:boolean}
export interface MemberSource {documentId:string;version:string;data:AssistantPublication;photos:MemberPhoto[];published:boolean}
