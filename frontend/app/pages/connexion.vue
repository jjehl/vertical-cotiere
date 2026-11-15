<script setup lang="ts">
import type {MemberLoginAccount,MemberLoginResult} from '#shared/member';
import {memberReturnPath} from '#shared/member-google';
const {profile,api}=useMember();
const route=useRoute();
const returnPath=computed(()=>memberReturnPath(route.query.retour));
const linking=computed(()=>route.query.google==='lier');
const googleMessages:Record<string,string>={expire:'La connexion Google a expiré. Recommencez.',annule:'La connexion Google a été annulée.',erreur:'Connexion Google impossible. Réessayez ou utilisez votre mot de passe.',indisponible:'La connexion Google est momentanément indisponible.'};
const googleMessage=computed(()=>typeof route.query.google==='string'?googleMessages[route.query.google]:'');
const interactive=useInteractive();
const email=ref('');const password=ref('');const busy=ref(false);const error=ref('');
const accounts=ref<MemberLoginAccount[]>([]);const accountId=ref<number|null>(null);
const accountPicker=ref<HTMLFieldSetElement|null>(null);
watch(email,()=>{if(!linking.value){accounts.value=[];accountId.value=null;error.value='';}});
const {data:pending,error:pendingError}=await useFetch<{email:string;accounts:MemberLoginAccount[]}>('/api/member/google/pending',{immediate:linking.value,key:'member-google-pending'});
if(linking.value&&pending.value){email.value=pending.value.email;accounts.value=pending.value.accounts;if(accounts.value.length===1)accountId.value=accounts.value[0]!.id;}
async function login(){
  if(busy.value)return;
  if(linking.value&&!accountId.value){error.value='Choisissez le compte à associer à Google.';return;}
  if(accounts.value.length&&!accountId.value){error.value='Choisissez le compte avec lequel vous souhaitez vous connecter.';return;}
  busy.value=true;error.value='';
  try{
    const result=await api<MemberLoginResult>(linking.value?'/api/member/google/link':'/api/member/login',{method:'POST',body:linking.value?{accountId:accountId.value,password:password.value}:{email:email.value,password:password.value,...(accountId.value?{accountId:accountId.value}:{})}});
    if(result.accounts){accounts.value=result.accounts;await nextTick();accountPicker.value?.focus();return;}
    profile.value=result.profile;password.value='';await navigateTo(returnPath.value);
  }catch(value){error.value=memberError(value);}finally{busy.value=false;}
}
useSeoMeta({title:'Connexion — Vertical Côtière',robots:'noindex, nofollow'});
</script>
<template>
  <MemberAuthLayout>
    <span class="eyebrow">Mon espace membre</span>
    <h1>Heureux de<br><em>vous retrouver.</em></h1>
    <p class="auth-intro">Votre profil, vos infos et la vie du club, à portée de main.</p>
    <p v-if="route.query.email==='confirme'" class="member-success" role="status">Votre adresse e-mail est validée. Vous pouvez vous connecter.</p>
    <p v-if="googleMessage" class="member-error" role="alert">{{googleMessage}}</p>
    <MemberGoogleButton v-if="!linking" :return-path="returnPath"/>
    <p v-if="linking" class="auth-intro">Un compte utilise déjà votre adresse Google. Pour l’associer, choisissez votre compte et confirmez son mot de passe. Votre profil et votre rôle seront conservés.</p>
    <p v-if="linking&&(pendingError||!accounts.length)" class="member-error" role="alert">Aucun compte ne peut être associé pour cette demande. Connectez-vous avec votre mot de passe, validez votre adresse e-mail ou contactez le club.</p>
    <form class="auth-form" @submit.prevent="login">
      <p v-if="error" class="member-error" role="alert">{{error}}</p>
      <div class="auth-field"><label for="login-email">Identifiant ou adresse e-mail</label><input id="login-email" v-model="email" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="prenom.nom" required maxlength="254" :disabled="busy||!interactive||linking"></div>
      <fieldset v-if="accounts.length" ref="accountPicker" class="auth-accounts" tabindex="-1">
        <legend>Choisissez votre compte</legend>
        <p class="auth-hint">{{accounts.length>1?'Plusieurs membres partagent cette adresse e-mail. Utilisez le mot de passe du compte choisi.':'Confirmez le mot de passe de ce compte pour l’associer à Google.'}}</p>
        <label v-for="account in accounts" :key="account.id" class="auth-account">
          <input v-model="accountId" type="radio" name="account" :value="account.id" required :disabled="busy||!interactive">
          <span><strong>{{[account.firstName,account.lastName].filter(Boolean).join(' ')||account.username}}</strong><small>{{account.username}}</small></span>
        </label>
      </fieldset>
      <MemberPasswordField id="login-password" v-model="password" label="Mot de passe" autocomplete="current-password" :disabled="busy||!interactive"><NuxtLink to="/mot-de-passe-oublie">Mot de passe oublié ?</NuxtLink></MemberPasswordField>
      <button class="auth-submit" :disabled="busy||!interactive||(linking&&!accounts.length)" type="submit"><span>{{busy?'Connexion…':linking?'Associer Google et me connecter':'Se connecter'}}</span><ArrowIcon/></button>
    </form>
    <p v-if="linking" class="auth-switch"><a :href="'/connexion?retour='+encodeURIComponent(returnPath)">Annuler l’association</a></p>
    <p class="auth-switch">Vous découvrez l’espace membre ?<br><NuxtLink to="/creer-un-compte">Créer mon compte <span aria-hidden="true">↗</span></NuxtLink></p>
  </MemberAuthLayout>
</template>
