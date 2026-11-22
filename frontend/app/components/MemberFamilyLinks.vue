<script setup lang="ts">
import {directoryDate,directoryPersonName} from '#shared/member-directory';
import type {DirectoryPerson,DirectoryProfileInput,MemberDirectory} from '#shared/member-directory';
const props=defineProps<{subjectId:number;relation:'guardians'|'dependents';people:DirectoryPerson[]}>();
const emit=defineEmits<{changed:[]}>();
const {api}=useMember();
const interactive=useInteractive();
const guardian=props.relation==='guardians';
const noun=guardian?'un responsable':'un adhérent à charge';
const mode=ref<'search'|'create'|null>(null);
const previous=ref<DirectoryPerson|null>(null);
const query=ref('');
const results=ref<MemberDirectory|null>(null);
const available=computed(()=>results.value?.members.filter(person=>person.id!==props.subjectId&&!props.people.some(link=>link.id===person.id))||[]);
const busy=ref(false);
const error=ref('');
const notice=ref('');
function open(person:DirectoryPerson|null){
  mode.value='search';previous.value=person;results.value=null;query.value='';error.value='';notice.value='';
}
async function search(page=1){
  if(busy.value)return;
  busy.value=true;error.value='';results.value=null;
  try{results.value=await api<MemberDirectory>('/api/member/directory',{query:{q:query.value.trim(),page,pageSize:20}});}
  catch(cause){error.value=memberError(cause);}
  finally{busy.value=false;}
}
async function change(body:{previousId?:number;memberId?:number;newMember?:DirectoryProfileInput},message:string){
  await api('/api/member/directory/'+props.subjectId+'/family',{method:'PUT',body:{relation:props.relation,...body}});
  mode.value=null;notice.value=message;emit('changed');
}
async function select(memberId:number){
  busy.value=true;error.value='';
  try{await change({previousId:previous.value?.id,memberId},previous.value?'Lien remplacé.':'Lien ajouté.');}
  catch(cause){error.value=memberError(cause);}
  finally{busy.value=false;}
}
async function create(newMember:DirectoryProfileInput){
  await change({previousId:previous.value?.id,newMember},'Fiche créée et liée.');
}
async function unlink(person:DirectoryPerson){
  if(!window.confirm('Retirer le lien avec '+directoryPersonName(person)+' ? Les deux fiches seront conservées.'))return;
  busy.value=true;error.value='';notice.value='';
  try{await change({previousId:person.id},'Lien retiré.');}
  catch(cause){error.value=memberError(cause);}
  finally{busy.value=false;}
}
</script>
<template>
  <section class="family-group">
    <h3>{{guardian?'Responsables':'Adhérents à charge'}}</h3>
    <p v-if="!people.length">{{guardian?'Aucun responsable rattaché.':'Aucun adhérent à charge.'}}</p>
    <ul v-else class="family-list">
      <li v-for="person in people" :key="person.id">
        <NuxtLink :to="'/membres/'+person.id" class="text-link">{{directoryPersonName(person)}}</NuxtLink>
        <div v-if="!mode" class="directory-controls">
          <MemberActionButton :disabled="busy||!interactive" @click="open(person)">Remplacer</MemberActionButton>
          <MemberActionButton tone="quiet" :disabled="busy||!interactive" @click="unlink(person)">Retirer le lien</MemberActionButton>
        </div>
      </li>
    </ul>
    <MemberActionButton icon="add" v-if="!mode" :disabled="busy||!interactive" @click="open(null)">Ajouter {{noun}}</MemberActionButton>
    <template v-if="mode==='search'">
      <p v-if="previous">Remplacer le lien avec <strong>{{directoryPersonName(previous)}}</strong></p>
      <form class="member-form" @submit.prevent="search()">
        <label>Rechercher {{noun}}<input v-model="query" type="search" maxlength="120" placeholder="Nom, téléphone ou e-mail" :disabled="busy" @input="results=null"></label>
        <div class="directory-controls">
          <MemberActionButton tone="primary" icon="search" type="submit" :disabled="busy">Rechercher</MemberActionButton>
          <MemberActionButton icon="add" :disabled="busy" @click="mode='create';error=''">Créer une fiche</MemberActionButton>
          <MemberActionButton tone="quiet" :disabled="busy" @click="mode=null;error=''">Annuler</MemberActionButton>
        </div>
      </form>
      <template v-if="results">
        <ul class="family-list"><li v-for="person in available" :key="person.id">
          <span><strong>{{directoryPersonName(person)}}</strong><br><small>Fiche n° {{person.id}} · {{[person.membershipBirthDate?directoryDate(person.membershipBirthDate):'',person.email,person.phone].filter(Boolean).join(' · ')}}</small></span>
          <MemberActionButton icon="check" :disabled="busy" @click="select(person.id)">Choisir</MemberActionButton>
        </li></ul>
        <p v-if="!available.length">Aucune fiche à rattacher sur cette page.</p>
        <div v-if="results.pagination.pageCount>1" class="directory-controls">
          <MemberActionButton icon="previous" :disabled="busy||results.pagination.page===1" @click="search(results.pagination.page-1)">Précédent</MemberActionButton>
          <span>Page {{results.pagination.page}} sur {{results.pagination.pageCount}}</span>
          <MemberActionButton icon="next" :disabled="busy||results.pagination.page===results.pagination.pageCount" @click="search(results.pagination.page+1)">Suivant</MemberActionButton>
        </div>
      </template>
    </template>
    <MemberDirectoryForm v-if="mode==='create'" :title="'Créer '+noun" :save="create" @cancel="mode='search'"/>
    <p v-if="error" class="member-error" role="alert">{{error}}</p>
    <p v-if="notice" role="status">{{notice}}</p>
  </section>
</template>
<style scoped>
.family-group {padding-block:12px;border-top:1px solid var(--line)}
.family-list {padding:0;list-style:none}
.family-list li {display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;overflow-wrap:anywhere;margin:12px 0}
</style>
