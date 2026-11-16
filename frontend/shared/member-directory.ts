import type {MemberProfile} from './member';
export const memberRoleLabels={basic:'Utilisateur basique',contributor:'Contributeur',admin:'Administrateur membre'};
export const registrationStatusLabels={creating:'Lancement à vérifier',pending:'Paiement en attente',confirmed:'Paiement confirmé',cancelled:'Dossier annulé'};
export interface DirectoryMember extends Omit<MemberProfile,'emailConfirmed'|'hasPassword'|'googleConnected'> {
  confirmed:boolean;blocked:boolean;createdAt:string;updatedAt:string;
  membershipBirthDate:string|null;provider:string;registrationInviteSentAt:string|null;
}
export interface MemberDirectory {
  members:DirectoryMember[];
  pagination:{page:number;pageSize:number;total:number;pageCount:number};
}
export interface DirectoryPerson {id:number;firstName:string;lastName:string;username:string;email:string}
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
  member:DirectoryMember;registrations:DirectoryRegistration[];
  participations:{id:number;confirmedAt:string;registeredByMember:DirectoryPerson|null;title:string;url:string|null;start:string|null;location:string|null}[];
}
export const memberAccountStatus=(member:DirectoryMember)=>member.blocked?'Bloqué':member.confirmed?'Actif':'À confirmer';
export function directoryDate(value:string|null|undefined) {
  if(!value)return 'Non renseigné';
  const date=new Date(value);
  return Number.isNaN(date.getTime())?'Non renseigné':new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium',timeZone:'Europe/Paris'}).format(date);
}
export const directoryMoney=(cents:number)=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(cents/100);
