import type {TrainingSlot} from './types'
export type RegistrationTariff = 'STANDARD' | 'CCMP1OU2' | 'FAM' | 'CCMP3'
export interface RegistrationSlot extends TrainingSlot {
  code:string;
  remaining:number|null;
  registrationEnabled:boolean;
  prices:Record<RegistrationTariff,number|null>;
}
export interface RegistrationCatalog {
  season:string;
  open:boolean;
  opensAt?:string|null;
  paymentReady:boolean;
  sessions:RegistrationSlot[];
}
export interface RegistrationStatus {
  reference:string;
  firstName:string;
  lastName:string;
  email:string;
  accountCreated:boolean;
  accountPending:boolean;
  invitationPending:boolean;
  status:'creating'|'pending'|'confirmed'|'cancelled';
  slotLabel:string;
  amountCents:number;
  checkoutUrl:string|null;
  verificationUnavailable?:boolean;
}
export const registrationTariffs:{code:RegistrationTariff;label:string;description:string}[]=[
  {code:'STANDARD',label:'Tarif standard',description:'Hors CCMP · 1er ou 2e adhérent'},
  {code:'CCMP1OU2',label:'Résident CCMP',description:'Dans la CCMP · 1er ou 2e adhérent'},
  {code:'FAM',label:'Famille hors CCMP',description:'À partir du 3e adhérent de la famille'},
  {code:'CCMP3',label:'Famille CCMP',description:'À partir du 3e adhérent · résident CCMP'},
]
