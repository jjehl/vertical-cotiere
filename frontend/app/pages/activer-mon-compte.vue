<script setup lang="ts">
const route=useRoute()
const interactive=useInteractive()
const code=ref(typeof route.query.code==='string'?route.query.code:'')
const password=ref('');const confirmation=ref('');const busy=ref(false);const saved=ref(false);const error=ref('')
const valid=computed(()=>/^[a-f0-9]{64}$/.test(code.value))
async function activate(){
  if(busy.value)return
  error.value=''
  if(password.value!==confirmation.value){error.value='Les mots de passe ne correspondent pas.';return}
  busy.value=true
  try{await $fetch('/api/registrations/activate',{method:'POST',body:{code:code.value,password:password.value,passwordConfirmation:confirmation.value}});password.value='';confirmation.value='';code.value='';saved.value=true;await navigateTo('/activer-mon-compte',{replace:true})}
  catch(value:unknown){const failure=value as {data?:{data?:{message?:string}}};error.value=failure.data?.data?.message||'L’activation a échoué. Réessayez ou contactez le secrétariat.'}
  finally{busy.value=false}
}
useHead({meta:[{name:'referrer',content:'no-referrer'}]})
useSeoMeta({title:'Activer mon compte — Vertical Côtière',robots:'noindex, nofollow'})
</script>
<template>
  <MemberAuthLayout>
    <span class="eyebrow">Bienvenue au club</span><h1>Votre compte,<br><em>votre aventure.</em></h1>
    <div v-if="saved" class="auth-confirmation" role="status"><h2>Votre compte est activé</h2><p>Votre adresse e-mail est validée. Vous pouvez vous connecter avec l’identifiant reçu par e-mail et votre mot de passe.</p><NuxtLink to="/connexion" class="auth-submit">Se connecter <ArrowIcon /></NuxtLink></div>
    <div v-else-if="!valid" class="auth-confirmation"><h2>Ouvrez votre lien d’activation</h2><p>Utilisez le lien reçu après votre inscription. En cas de lien expiré, contactez <a href="mailto:secretariat@vertical-cotiere.fr">le secrétariat</a>.</p></div>
    <template v-else>
      <p class="auth-intro">Votre inscription a été réglée. Choisissez votre mot de passe pour valider votre adresse e-mail et activer votre compte membre.</p>
      <form class="auth-form" @submit.prevent="activate">
        <p v-if="error" class="member-error" role="alert">{{ error }}</p>
        <MemberPasswordField id="activate-password" v-model="password" label="Mot de passe" :minlength="12" :disabled="busy||!interactive" />
        <MemberPasswordField id="activate-confirmation" v-model="confirmation" label="Confirmer le mot de passe" :disabled="busy||!interactive" />
        <button type="submit" class="auth-submit" :disabled="busy||!interactive">{{ busy?'Activation…':'Valider mon e-mail et activer mon compte' }} <ArrowIcon /></button>
      </form>
    </template>
  </MemberAuthLayout>
</template>
