<script setup lang="ts">
const {api}=useMember();
const interactive=useInteractive();
const email=ref('');const busy=ref(false);const sent=ref(false);const error=ref('');
async function requestReset(){
  if(busy.value)return;
  busy.value=true;error.value='';
  try{await api('/api/member/forgot-password',{method:'POST',body:{email:email.value}});sent.value=true;}
  catch(value){error.value=memberError(value);}finally{busy.value=false;}
}
useSeoMeta({title:'Mot de passe oublié — Vertical Côtière',robots:'noindex, nofollow'});
</script>
<template>
  <MemberAuthLayout>
    <span class="eyebrow">Un nouveau départ</span><h1>Un oubli,<br><em>ça arrive.</em></h1>
    <p class="auth-intro">Indiquez votre adresse e-mail pour recevoir un lien et choisir un nouveau mot de passe.</p>
    <div v-if="sent" class="auth-confirmation" role="status"><span class="auth-confirmation-icon" aria-hidden="true">↗</span><h2>Consultez vos e-mails</h2><p>Si un compte correspond à cette adresse, vous recevrez un lien valable une heure. Si plusieurs comptes la partagent, un e-mail distinct indique l’identifiant de chaque compte. Pensez à vérifier vos courriers indésirables.</p></div>
    <form v-else class="auth-form" @submit.prevent="requestReset">
      <p v-if="error" class="member-error" role="alert">{{error}}</p>
      <div class="auth-field"><label for="forgot-email">Adresse e-mail</label><input id="forgot-email" v-model="email" type="email" autocomplete="email" placeholder="vous@exemple.fr" required maxlength="254" :disabled="busy||!interactive"></div>
      <button class="auth-submit" type="submit" :disabled="busy||!interactive"><span>{{busy?'Envoi en cours…':'Recevoir le lien'}}</span><ArrowIcon/></button>
    </form>
    <p class="auth-switch"><NuxtLink to="/connexion">← Retour à la connexion</NuxtLink></p>
  </MemberAuthLayout>
</template>
