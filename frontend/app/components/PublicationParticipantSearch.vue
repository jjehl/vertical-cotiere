<script setup lang="ts">
import type {MemberParticipationPoll,ParticipationMember,ParticipationMemberSearch} from '#shared/member';
const props=defineProps<{slug:string}>();
const emit=defineEmits<{registered:[poll:MemberParticipationPoll,message:string]}>();
const {api}=useMember();
const fieldId=useId();
const query=ref('');const results=ref<ParticipationMember[]>([]);const hasMore=ref(false);
const selected=ref<ParticipationMember|null>(null);
const loading=ref(false);const busy=ref(false);const searched=ref(false);const error=ref('');
const input=ref<HTMLInputElement>();const confirmButton=ref<HTMLButtonElement>();
let timer:ReturnType<typeof setTimeout>|undefined;
let controller:AbortController|undefined;
let version=0;
const endpoint=computed(()=>'/api/member/publications/'+encodeURIComponent(props.slug)+'/poll');
function invalidate(){version++;clearTimeout(timer);controller?.abort();}
watch(query,()=>{
  invalidate();results.value=[];hasMore.value=false;selected.value=null;error.value='';searched.value=false;
  loading.value=!!query.value.trim();
  if(query.value.trim())timer=setTimeout(search,250);
});
onBeforeUnmount(invalidate);
async function search() {
  invalidate();const current=version;
  if(!query.value.trim()){loading.value=false;return;}
  controller=new AbortController();loading.value=true;error.value='';
  try {
    const response=await api<ParticipationMemberSearch>(endpoint.value+'/members',{query:{q:query.value.trim()},signal:controller.signal});
    if(current!==version)return;
    results.value=response.members;hasMore.value=response.hasMore;searched.value=true;
  }catch(value){if(current===version)error.value=memberError(value);}
  finally{if(current===version)loading.value=false;}
}
async function select(member:ParticipationMember){selected.value=member;error.value='';await nextTick();confirmButton.value?.focus();}
async function cancel(){selected.value=null;error.value='';await nextTick();input.value?.focus();}
async function register() {
  if(busy.value||!selected.value)return;
  const member=selected.value;
  busy.value=true;error.value='';
  try {
    const poll=await api<MemberParticipationPoll>(endpoint.value+'/register',{method:'POST',body:{confirmed:true,memberId:member.id}});
    query.value='';selected.value=null;
    emit('registered',poll,`${member.name} est inscrit à cet événement.`);
  }catch(value){error.value=memberError(value);}
  finally{busy.value=false;await nextTick();if(!selected.value)input.value?.focus();}
}
</script>
<template>
  <div class="event-member-search">
    <label :for="fieldId">Inscrire un autre membre</label>
    <input :id="fieldId" ref="input" v-model="query" type="search" placeholder="Nom, prénom ou quelques lettres…" maxlength="80" autocomplete="off" :disabled="busy" :aria-describedby="fieldId+'-hint'">
    <p :id="fieldId+'-hint'" class="fine-print">Recherchez un membre, puis sélectionnez son nom.</p>
    <p v-if="loading" role="status">Recherche…</p>
    <template v-else-if="!selected">
      <ul v-if="results.length" class="event-member-results" aria-label="Membres trouvés">
        <li v-for="member in results" :key="member.id">
          <button type="button" :disabled="member.registered" @click="select(member)">{{member.name}}<span v-if="member.registered"> — déjà inscrit</span></button>
        </li>
      </ul>
      <p v-else-if="searched" role="status">Aucun membre trouvé.</p>
      <p v-if="hasMore" class="fine-print">D’autres membres correspondent. Précisez votre recherche.</p>
    </template>
    <form v-if="selected" class="event-poll-confirmation" aria-label="Confirmer l’inscription d’un membre" @submit.prevent="register" @keydown.esc.prevent="!busy&&cancel()">
      <p>En inscrivant <strong>{{selected.name}}</strong>, vous confirmez sa participation à cet événement et son engagement à être présent, sauf imprévu indépendant de sa volonté.</p>
      <button ref="confirmButton" type="submit" class="button button-orange" :disabled="busy">{{busy?'Inscription…':'Confirmer son inscription'}}</button>
      <button type="button" class="event-poll-cancel" :disabled="busy" @click="cancel">Annuler</button>
    </form>
    <p v-if="error" class="event-poll-error" role="alert">{{error}} <button v-if="!selected" type="button" class="event-poll-cancel" @click="search">Réessayer</button></p>
  </div>
</template>
