<script setup lang="ts">
import type {MemberParticipationPoll} from '#shared/member';
const props=defineProps<{slug:string;memberReady:boolean;hasPoll?:boolean}>();
const {profile,api}=useMember();
const poll=ref<MemberParticipationPoll|null>(null);
const loading=ref(false);const busy=ref(false);const error=ref('');const message=ref('');const confirming=ref(false);
const registerButton=ref<HTMLButtonElement>();const confirmButton=ref<HTMLButtonElement>();
const endpoint=computed(()=>'/api/member/publications/'+encodeURIComponent(props.slug)+'/poll');
let requestVersion=0;
async function load() {
  const version=++requestVersion;
  poll.value=null;error.value='';message.value='';confirming.value=false;
  if(!props.memberReady||!profile.value){loading.value=false;return;}
  loading.value=true;
  try{const result=await api<MemberParticipationPoll>(endpoint.value);if(version===requestVersion)poll.value=result;}
  catch(value){if(version===requestVersion)error.value=memberError(value);}
  finally{if(version===requestVersion)loading.value=false;}
}
watch(()=>[props.memberReady,profile.value?.id,props.slug],load,{immediate:true});
onBeforeUnmount(()=>{requestVersion++;});
async function submit(register=false) {
  if(busy.value)return;
  const version=requestVersion;
  busy.value=true;error.value='';message.value='';
  try {
    const result=await api<MemberParticipationPoll>(endpoint.value+(register?'/register':''),{method:'POST',body:register?{confirmed:true}:{}});
    if(version!==requestVersion)return;
    poll.value=result;confirming.value=false;
    message.value=register?'Votre inscription est confirmée.':'Le sondage de participation a été ajouté.';
  }catch(value){if(version===requestVersion)error.value=memberError(value);}
  finally{busy.value=false;}
}
async function askConfirmation(){confirming.value=true;error.value='';await nextTick();confirmButton.value?.focus();}
async function cancel(){confirming.value=false;error.value='';await nextTick();registerButton.value?.focus();}
</script>
<template>
  <div class="event-aside-heading">
    <span class="eyebrow">Le rendez-vous</span>
    <button v-if="memberReady&&profile?.role==='contributor'&&poll&&!poll.exists&&poll.open" type="button" class="event-add-poll" :disabled="busy" @click="submit()">
      <span aria-hidden="true">+</span> {{busy?'Ajout…':'Ajouter un sondage'}}
    </button>
  </div>
  <slot/>
  <section v-if="memberReady&&profile" class="event-poll" aria-label="Sondage de participation" :aria-busy="loading||busy">
    <p v-if="loading" role="status">Chargement des participations…</p>
    <template v-if="poll?.exists">
      <h3>Sondage de participation</h3>
      <p v-if="poll.registered" class="event-poll-registered">✓ Vous êtes inscrit à cet événement.</p>
      <template v-else-if="poll.open">
        <button v-if="!confirming" ref="registerButton" type="button" class="button button-orange" @click="askConfirmation">Je m’inscris <ArrowIcon/></button>
        <form v-else class="event-poll-confirmation" aria-label="Confirmer mon inscription" @submit.prevent="submit(true)" @keydown.esc.prevent="!busy&&cancel()">
          <p>En confirmant votre participation, vous vous engagez à être présent à cet événement, sauf imprévu indépendant de votre volonté.</p>
          <button ref="confirmButton" type="submit" class="button button-orange" :disabled="busy">{{busy?'Inscription…':'Confirmer ma participation'}}</button>
          <button type="button" class="event-poll-cancel" :disabled="busy" @click="cancel">Annuler</button>
        </form>
      </template>
      <PublicationParticipantSearch v-if="poll.open" :slug="slug" @registered="(result,notice)=>{poll=result;message=notice;}"/>
      <p v-if="!poll.open">Les inscriptions sont closes.</p>
      <h3>Participants ({{poll.participants.length}})</h3>
      <ul v-if="poll.participants.length" class="event-poll-participants">
        <li v-for="(participant,index) in poll.participants" :key="index">{{participant.name}}<span v-if="participant.isCurrentMember"> (vous)</span></li>
      </ul>
      <p v-else>Aucun participant pour le moment.</p>
      <p class="fine-print">Cette liste est visible uniquement par les membres connectés.</p>
    </template>
    <p v-if="message" role="status">{{message}}</p>
    <p v-if="error" class="event-poll-error" role="alert">{{error}} <button v-if="!poll" type="button" class="event-poll-cancel" @click="load">Réessayer</button></p>
  </section>
  <section v-else-if="memberReady&&hasPoll" class="event-poll" aria-label="Sondage de participation">
    <h3>Sondage de participation</h3>
    <p>Connectez-vous pour vous inscrire et consulter les participants.</p>
    <NuxtLink :to="{path:'/connexion',query:{retour:'/vie-du-club/'+slug}}" class="button button-orange">Je m’inscris <ArrowIcon/></NuxtLink>
  </section>
</template>
