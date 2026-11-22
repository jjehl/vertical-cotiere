import type {MemberProfile} from './member';
export const memberRoleLabels={basic:'Utilisateur basique',contributor:'Contributeur',admin:'Administrateur membre'};
export const registrationStatusLabels={creating:'Lancement à vérifier',pending:'Paiement en attente',confirmed:'Paiement confirmé',cancelled:'Dossier annulé'};
export const validityDateFields=[
  {key:'ffmeLicenseValidUntil',label:'Fin de validité de la licence FFME',type:'date'},
  {key:'clubMembershipValidUntil',label:'Fin de validité de la cotisation club',type:'date'},
] as const;
type ValidityDateKey=typeof validityDateFields[number]['key'];
export interface DirectoryMember extends Omit<MemberProfile,'emailConfirmed'|'hasPassword'|'googleConnected'|'email'>, Record<ValidityDateKey,string|null> {
  email:string|null;
  confirmed:boolean;blocked:boolean;createdAt:string;updatedAt:string;
  membershipBirthDate:string|null;competition:boolean;provider:string;registrationInviteSentAt:string|null;
}
export interface MemberDirectory {
  members:DirectoryMember[];
  pagination:{page:number;pageSize:number;total:number;pageCount:number};
}
export interface DirectoryPerson {id:number;firstName:string;lastName:string;username:string;email:string|null;phone?:string|null}
export interface DirectoryRegistration {
  id:number;reference:string;season:string;slotCode:string;slotLabel:string;
  firstName:string;lastName:string;birthDate:string;email:string;address:string;
  promoCode:string|null;familyReference:string|null;amountCents:number;
  registrationStatus:keyof typeof registrationStatusLabels;
  payerFirstName:string;payerLastName:string;payerEmail:string|null;
  checkoutIntentId:string|null;checkoutCreatedAt:string|null;confirmedAt:string|null;
  createdAt:string;updatedAt:string;memberCreated:boolean;
  member:DirectoryPerson|null;payer:DirectoryPerson|null;isParticipant:boolean;isPayer:boolean;
}
export interface MemberDetails {
  member:DirectoryMember;canEditEmail:boolean;guardians:DirectoryPerson[];dependents:DirectoryPerson[];secondGuardianContact:{email:string|null;phone:string|null}|null;registrations:DirectoryRegistration[];
  participations:{id:number;confirmedAt:string;registeredByMember:DirectoryPerson|null;title:string;url:string|null;start:string|null;location:string|null}[];
}
export const memberAccountStatus=(member:DirectoryMember)=>member.blocked?'Bloqué':member.provider==='contact'?'Fiche contact':member.confirmed?'Actif':'À confirmer';
export function directoryDate(value:string|null|undefined) {
  if(!value)return 'Non renseigné';
  const date=new Date(value);
  return Number.isNaN(date.getTime())?'Non renseigné':new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium',timeZone:'Europe/Paris'}).format(date);
}
export const directoryMoney=(cents:number)=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(cents/100);

export type DirectoryProfileInput = Partial<Record<ValidityDateKey|'firstName'|'lastName'|'membershipBirthDate'|'email'|'phone'|'street'|'postalCode'|'city'|'country'|'ffmeLicenseNumber',string> & {competition:boolean}>;
export const directoryPersonName = (person:DirectoryPerson) =>
  [person.firstName,person.lastName].filter(Boolean).join(' ') || person.email || person.phone || person.username;
