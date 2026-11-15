<script setup lang="ts">
import type {MemberProfile} from '#shared/member';
const {profile,api}=useMember();
const interactive=useInteractive();
const form=reactive({firstName:'',lastName:'',username:'',email:'',password:''});const confirmation=ref('');const error=ref('');const busy=ref(false);const sent=ref(false);
async function register(){if(busy.value)return;error.value='';if(form.password!==confirmation.value){error.value='Les mots de passe ne correspondent pas.';return;}busy.value=true;try{const result=await api<{profile?:MemberProfile;requiresConfirmation?:boolean}>('/api/member/register',{method:'POST',body:form});form.password='';confirmation.value='';if(result.requiresConfirmation){sent.value=true;return;}profile.value=result.profile||null;await navigateTo('/compte');}catch(value){error.value=memberError(value);}finally{busy.value=false;}}
useSeoMeta({title:'Créer mon compte — Vertical Côtière',robots:'noindex, nofollow'});
</script>
<template>
  <MemberAuthLayout>
    <span class="eyebrow">Bienvenue chez vous</span><h1>Gardons<br><em>le lien.</em></h1>
    <p class="auth-intro">Créez votre compte pour retrouver vos informations et votre licence au même endroit.</p>
    <MemberGoogleButton v-if="!sent"/>
    <p v-if="sent" class="member-success" role="status">Votre compte a été créé. Consultez votre messagerie pour confirmer votre adresse avant de vous connecter.</p>
    <form v-else class="auth-form" @submit.prevent="register">
      <p v-if="error" class="member-error" role="alert">{{error}}</p>
      <div class="member-fields">
        <div class="auth-field"><label for="register-firstName">Prénom</label><input id="register-firstName" v-model="form.firstName" autocomplete="given-name" required maxlength="80" :disabled="busy||!interactive"></div>
        <div class="auth-field"><label for="register-lastName">Nom</label><input id="register-lastName" v-model="form.lastName" autocomplete="family-name" required maxlength="80" :disabled="busy||!interactive"></div>
      </div>
      <div class="auth-field"><label for="register-username">Identifiant</label><input id="register-username" v-model="form.username" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="prenom.nom" required minlength="3" maxlength="80" pattern="[a-zA-Z0-9._\-]{3,80}" :disabled="busy||!interactive"></div>
      <p class="auth-hint">Un identifiant unique par membre : lettres, chiffres, points, tirets ou underscores.</p>
      <div class="auth-field"><label for="register-email">Adresse e-mail</label><input id="register-email" v-model="form.email" type="email" autocomplete="email" placeholder="vous@exemple.fr" required maxlength="254" :disabled="busy||!interactive"></div>
      <p class="auth-hint">La même adresse peut être utilisée pour plusieurs membres de la famille.</p>
      <MemberPasswordField id="register-password" v-model="form.password" label="Mot de passe" :minlength="12" :disabled="busy||!interactive"/>
      <p class="auth-hint">12 caractères minimum.</p>
      <MemberPasswordField id="register-confirmation" v-model="confirmation" label="Confirmer le mot de passe" :disabled="busy||!interactive"/>
      <button class="auth-submit" :disabled="busy||!interactive" type="submit"><span>{{busy?'Création…':'Créer mon compte'}}</span><ArrowIcon/></button>
    </form>
    <p class="auth-switch">Déjà membre ? <NuxtLink to="/connexion">Se connecter ↗</NuxtLink></p>
  </MemberAuthLayout>
</template>
