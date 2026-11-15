<script setup lang="ts">
const {profile,api}=useMember();
const interactive=useInteractive();
const email=ref('');const password=ref('');const busy=ref(false);const error=ref('');
async function login(){if(busy.value)return;busy.value=true;error.value='';try{const result=await api<{profile:import('#shared/member').MemberProfile}>('/api/member/login',{method:'POST',body:{email:email.value,password:password.value}});profile.value=result.profile;password.value='';await navigateTo('/compte');}catch(value){error.value=memberError(value);}finally{busy.value=false;}}
useSeoMeta({title:'Connexion — Vertical Côtière',robots:'noindex, nofollow'});
</script>
<template>
  <MemberAuthLayout>
    <span class="eyebrow">Mon espace membre</span>
    <h1>Heureux de<br><em>vous retrouver.</em></h1>
    <p class="auth-intro">Votre profil, vos infos et la vie du club, à portée de main.</p>
    <form class="auth-form" @submit.prevent="login">
      <p v-if="error" class="member-error" role="alert">{{error}}</p>
      <div class="auth-field"><label for="login-email">Adresse e-mail</label><input id="login-email" v-model="email" type="email" autocomplete="username" placeholder="vous@exemple.fr" required maxlength="254" :disabled="busy||!interactive"></div>
      <MemberPasswordField id="login-password" v-model="password" label="Mot de passe" autocomplete="current-password" :disabled="busy||!interactive"><NuxtLink to="/mot-de-passe-oublie">Mot de passe oublié ?</NuxtLink></MemberPasswordField>
      <button class="auth-submit" :disabled="busy||!interactive" type="submit"><span>{{busy?'Connexion…':'Se connecter'}}</span><ArrowIcon/></button>
    </form>
    <p class="auth-switch">Vous découvrez l’espace membre ?<br><NuxtLink to="/creer-un-compte">Créer mon compte <span aria-hidden="true">↗</span></NuxtLink></p>
  </MemberAuthLayout>
</template>
