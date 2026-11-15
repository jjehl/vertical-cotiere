<script setup lang="ts">
import type {MemberProfile} from '#shared/member';
definePageMeta({middleware:'member'});
const {profile,api,logout}=useMember();
const interactive=useInteractive();
const fields=['firstName','lastName','email','phone','street','postalCode','city','country','ffmeLicenseNumber'] as const;
const form=reactive(Object.fromEntries(fields.map(key=>[key,profile.value?.[key]||''])) as Record<typeof fields[number],string>);
const busy=ref(false);const error=ref('');const message=ref('');
const passwords=reactive({currentPassword:'',password:'',passwordConfirmation:''});const passwordMessage=ref('');const passwordError=ref('');const passwordBusy=ref(false);
async function save(){if(busy.value)return;busy.value=true;error.value='';message.value='';try{profile.value=await api<MemberProfile>('/api/member/profile',{method:'PUT',body:form});message.value=profile.value.emailConfirmed?'Votre profil a été enregistré.':'Votre profil a été enregistré. Consultez votre messagerie pour valider votre nouvelle adresse e-mail avant de vous reconnecter.';}catch(value){error.value=memberError(value);}finally{busy.value=false;}}
async function changePassword(){if(passwordBusy.value)return;passwordBusy.value=true;passwordError.value='';passwordMessage.value='';try{await api('/api/member/password',{method:'POST',body:passwords});passwords.currentPassword='';passwords.password='';passwords.passwordConfirmation='';passwordMessage.value='Votre mot de passe a été modifié.';}catch(value){passwordError.value=memberError(value);}finally{passwordBusy.value=false;}}
useSeoMeta({title:'Mon profil — Vertical Côtière',robots:'noindex, nofollow'});
</script>
<template>
  <div class="section member-page">
    <span class="eyebrow">Mon espace membre</span><h1>Bonjour,<br><em>{{profile?.firstName||'et bienvenue'}}.</em></h1>
    <nav class="member-actions" aria-label="Mon espace">
      <NuxtLink v-if="profile?.role==='contributor'" to="/mes-publications" class="button button-dark">Mes publications <ArrowIcon/></NuxtLink>
      <button type="button" class="button member-logout" :disabled="!interactive" @click="logout">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 5H5v14h4m5-12 5 5-5 5m-5-5h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Se déconnecter
      </button>
    </nav>
    <div class="member-layout">
      <form class="member-panel member-form" @submit.prevent="save">
        <h2>Mes informations</h2>
        <p>Mon identifiant : <strong>{{profile?.username}}</strong></p>
        <p v-if="error" class="member-error" role="alert">{{error}}</p><p v-if="message" class="member-success" role="status">{{message}}</p>
        <div class="member-fields">
          <label for="profile-firstName">Prénom<input id="profile-firstName" v-model="form.firstName" autocomplete="given-name" required maxlength="80" :disabled="busy||!interactive"></label>
          <label for="profile-lastName">Nom<input id="profile-lastName" v-model="form.lastName" autocomplete="family-name" required maxlength="80" :disabled="busy||!interactive"></label>
        </div>
        <label for="profile-email">Adresse e-mail<input id="profile-email" v-model="form.email" type="email" autocomplete="email" required maxlength="254" :disabled="busy||!interactive"></label>
        <label for="profile-phone">Téléphone<input id="profile-phone" v-model="form.phone" type="tel" autocomplete="tel" maxlength="40" :disabled="busy||!interactive"></label>
        <label for="profile-street">Adresse<input id="profile-street" v-model="form.street" autocomplete="street-address" maxlength="250" :disabled="busy||!interactive"></label>
        <div class="member-fields">
          <label for="profile-postalCode">Code postal<input id="profile-postalCode" v-model="form.postalCode" autocomplete="postal-code" maxlength="20" :disabled="busy||!interactive"></label>
          <label for="profile-city">Ville<input id="profile-city" v-model="form.city" autocomplete="address-level2" maxlength="120" :disabled="busy||!interactive"></label>
        </div>
        <label for="profile-country">Pays<input id="profile-country" v-model="form.country" autocomplete="country-name" maxlength="100" :disabled="busy||!interactive"></label>
        <label for="profile-license">Numéro de licence FFME<input id="profile-license" v-model="form.ffmeLicenseNumber" maxlength="40" :disabled="busy||!interactive"></label>
        <p class="fine-print">Renseignez le numéro figurant sur votre licence.</p>
        <button class="button button-dark" type="submit" :disabled="busy||!interactive">{{busy?'Enregistrement…':'Enregistrer mon profil'}}</button>
      </form>
      <aside class="member-sidebar">
        <section class="member-panel"><h2>Mon rôle</h2><p>{{profile?.role==='contributor'?'Contributeur':'Utilisateur basique'}}</p><p>{{profile?.role==='contributor'?'Vous pouvez créer, modifier et publier vos propres publications avec l’assistant IA.':'Vous pouvez consulter et modifier votre profil. Pour contribuer, contactez le club.'}}</p></section>
        <section v-if="profile?.googleConnected" class="member-panel"><h2>Connexion Google</h2><p>Votre compte est associé à Google.</p><p v-if="!profile.hasPassword">Pour utiliser aussi un mot de passe, <NuxtLink to="/mot-de-passe-oublie">demandez un lien pour en définir un</NuxtLink>.</p></section>
        <form v-if="profile?.hasPassword" class="member-panel member-form" @submit.prevent="changePassword">
          <h2>Changer mon mot de passe</h2>
          <p v-if="passwordError" class="member-error" role="alert">{{passwordError}}</p><p v-if="passwordMessage" class="member-success" role="status">{{passwordMessage}}</p>
          <label for="current-password">Mot de passe actuel<input id="current-password" v-model="passwords.currentPassword" type="password" autocomplete="current-password" required :disabled="passwordBusy||!interactive"></label>
          <label for="new-password">Nouveau mot de passe<input id="new-password" v-model="passwords.password" type="password" autocomplete="new-password" minlength="12" maxlength="72" required :disabled="passwordBusy||!interactive"></label>
          <label for="confirm-password">Confirmer le nouveau mot de passe<input id="confirm-password" v-model="passwords.passwordConfirmation" type="password" autocomplete="new-password" required :disabled="passwordBusy||!interactive"></label>
          <button type="submit" class="button button-dark" :disabled="passwordBusy||!interactive">Modifier mon mot de passe</button>
        </form>
      </aside>
    </div>
  </div>
</template>
