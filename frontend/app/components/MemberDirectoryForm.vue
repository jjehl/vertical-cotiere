<script setup lang="ts">
import {validityDateFields} from '#shared/member-directory';
import type {DirectoryMember,DirectoryProfileInput} from '#shared/member-directory';
const props=withDefaults(defineProps<{
  member?:DirectoryMember; canEditEmail?:boolean; title:string;
  save:(input:DirectoryProfileInput)=>Promise<void>;
}>(),{canEditEmail:true});
const emit=defineEmits<{cancel:[]}>();
const fields=[
  {key:'firstName',label:'Prénom',max:80},{key:'lastName',label:'Nom',max:80},
  {key:'membershipBirthDate',label:'Date de naissance',type:'date'},
  {key:'email',label:'E-mail',type:'email',max:254},{key:'phone',label:'Téléphone',type:'tel',max:40},
  {key:'street',label:'Adresse',max:250},{key:'postalCode',label:'Code postal',max:20},
  {key:'city',label:'Ville',max:120},{key:'country',label:'Pays',max:100},
  {key:'ffmeLicenseNumber',label:'Licence FFME',max:40},
  ...validityDateFields,
] as const;
const draft=reactive(Object.fromEntries(fields.map(({key})=>[key,props.member?.[key]||''])) as Record<typeof fields[number]['key'],string>);
const competition=ref(props.member?.competition??false);
const busy=ref(false);
const error=ref('');
async function submit(){
  if(busy.value)return;
  busy.value=true;error.value='';
  try {
    const input:DirectoryProfileInput={};
    for(const {key} of fields){
      const value=draft[key].trim();
      if(value!==(props.member?.[key]||''))input[key]=value;
    }
    if(competition.value!==(props.member?.competition??false))input.competition=competition.value;
    await props.save(input);
  }catch(cause){error.value=memberError(cause);}
  finally{busy.value=false;}
}
</script>
<template>
  <form class="member-panel member-form directory-editor" @submit.prevent="submit">
    <h3>{{title}}</h3>
    <div class="member-fields">
      <label v-for="field in fields" :key="field.key">{{field.label}}
        <input v-model="draft[field.key]" :type="'type' in field?field.type:'text'" :maxlength="'max' in field?field.max:undefined"
          :readonly="field.key==='email'&&canEditEmail===false" :disabled="busy">
        <small v-if="field.key==='email'&&canEditEmail===false">Le membre modifie son e-mail de connexion depuis son profil.</small>
      </label>
    </div>
    <label class="competition-check"><input v-model="competition" type="checkbox" :disabled="busy"> Compétiteur</label>
    <p v-if="error" class="member-error" role="alert">{{error}}</p>
    <div class="directory-controls">
      <MemberActionButton tone="primary" icon="check" type="submit" :disabled="busy">{{busy?'Enregistrement…':'Enregistrer'}}</MemberActionButton>
      <MemberActionButton tone="quiet" :disabled="busy" @click="emit('cancel')">Annuler</MemberActionButton>
    </div>
  </form>
</template>
<style scoped>
.directory-editor {margin-block:16px}
.directory-editor h3 {margin:0}
.directory-editor .competition-check {display:flex;align-items:center}
.competition-check input {width:auto;min-height:auto}
</style>
