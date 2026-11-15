<script setup lang="ts">
const route=useRoute();const {api}=useMember();const interactive=useInteractive();
const code=ref(typeof route.query.code==='string'?route.query.code:'');
const password=ref('');const confirmation=ref('');const busy=ref(false);const saved=ref(false);const error=ref('');
const valid=computed(()=>/^[a-f0-9]{128}$/.test(code.value));
async function reset(){
  if(busy.value)return;
  error.value='';if(password.value!==confirmation.value){error.value='Les mots de passe ne correspondent pas.';return;}
  busy.value=true;
  try{await api('/api/member/reset-password',{method:'POST',body:{code:code.value,password:password.value,passwordConfirmation:confirmation.value}});password.value='';confirmation.value='';saved.value=true;code.value='';await navigateTo('/reinitialiser-mot-de-passe',{replace:true});}
  catch(value){error.value=memberError(value);}finally{busy.value=false;}
}
useHead({meta:[{name:'referrer',content:'no-referrer'}]});
useSeoMeta({title:'Nouveau mot de passe — Vertical Côtière',robots:'noindex, nofollow'});
</script>
<template>
  <MemberAuthLayout>
    <span class="eyebrow">Votre espace vous attend</span><h1>À vous<br><em>de choisir.</em></h1>
    <div v-if="saved" class="auth-confirmation" role="status"><span class="auth-confirmation-icon" aria-hidden="true">✓</span><h2>Mot de passe modifié</h2><p>Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.</p><NuxtLink to="/connexion" class="auth-submit">Se connecter <ArrowIcon/></NuxtLink></div>
    <div v-else-if="!valid" class="auth-confirmation"><h2>Ce lien est incomplet</h2><p>Ouvrez le lien reçu par e-mail ou demandez-en un nouveau.</p><NuxtLink to="/mot-de-passe-oublie" class="auth-submit">Recevoir un nouveau lien <ArrowIcon/></NuxtLink></div>
    <template v-else>
      <p class="auth-intro">Choisissez un nouveau mot de passe d’au moins 12 caractères.</p>
      <form class="auth-form" @submit.prevent="reset">
        <p v-if="error" class="member-error" role="alert">{{error}} <NuxtLink to="/mot-de-passe-oublie">Demander un nouveau lien</NuxtLink></p>
        <MemberPasswordField id="reset-password" v-model="password" label="Nouveau mot de passe" :minlength="12" :disabled="busy||!interactive"/>
        <MemberPasswordField id="reset-confirmation" v-model="confirmation" label="Confirmer le nouveau mot de passe" :disabled="busy||!interactive"/>
        <button class="auth-submit" type="submit" :disabled="busy||!interactive"><span>{{busy?'Enregistrement…':'Enregistrer mon mot de passe'}}</span><ArrowIcon/></button>
      </form>
    </template>
    <p v-if="!saved" class="auth-switch"><NuxtLink to="/connexion">← Retour à la connexion</NuxtLink></p>
  </MemberAuthLayout>
</template>
