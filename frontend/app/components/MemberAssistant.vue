<script setup lang="ts">
import type {MemberPhoto,MemberPreview,MemberSource} from '#shared/member';
const props=defineProps<{documentId?:string}>();
const {api}=useMember();
const interactive=useInteractive();
const editing=Boolean(props.documentId);
const source=ref<MemberSource|null>(null);const instruction=ref('');const photos=ref<MemberPhoto[]>([]);const preview=ref<MemberPreview|null>(null);
const question=ref('');const error=ref('');const busy=ref('');const saved=ref<{documentId:string;title:string;published:boolean}|null>(null);
const preparing=computed(()=>busy.value==='Préparation de la proposition…');
const {data:status}=await useAsyncData('member-assistant-status',()=>api<{configured:boolean;canCreate:boolean}>('/api/member/assistant/status'));
async function load(){source.value=await api<MemberSource>('/api/member/assistant/publications/'+encodeURIComponent(props.documentId!));photos.value=source.value.photos.map(photo=>({...photo,url:'/api/member/photos/'+photo.id}));}
if(editing)try{await load();}catch(value){error.value=memberError(value);}
function invalidate(){preview.value=null;question.value='';saved.value=null;error.value='';}
async function run(label:string,operation:()=>Promise<void>){if(busy.value)return;busy.value=label;error.value='';try{await operation();}catch(value){error.value=memberError(value);}finally{busy.value='';}}
async function upload(event:Event){
  const input=event.target as HTMLInputElement;const files=Array.from(input.files||[]);input.value='';if(!files.length)return;
  if(files.length+photos.value.length>30){error.value='30 photos maximum par publication.';return;}
  if(files.some(file=>file.size>20*1024*1024)||files.reduce((sum,file)=>sum+file.size,0)>25*1024*1024){error.value='20 Mo maximum par photo et 25 Mo par import.';return;}
  invalidate();await run('Import des photos…',async()=>{const body=new FormData();files.forEach(file=>body.append('files',file));photos.value.push(...(await api<MemberPhoto[]>('/api/member/photos',{method:'POST',body})).map(photo=>({...photo,url:'/api/member/photos/'+photo.id})));});
}
async function prepare(){invalidate();await run('Préparation de la proposition…',async()=>{
  const result=await api<MemberPreview&{question?:string}>('/api/member/assistant/prepare',{method:'POST',body:{instruction:instruction.value,...(editing?{documentId:props.documentId,version:source.value!.version}:{photos:photos.value.map(photo=>photo.id)})}});
  if(result.question)question.value=result.question;else preview.value=result;
});}
async function confirm(mode:'draft'|'publish'){if(!preview.value)return;await run('Enregistrement…',async()=>{
  saved.value=await api('/api/member/assistant/confirm',{method:'POST',body:{previewId:preview.value!.previewId,mode}});
  preview.value=null;instruction.value='';if(editing)try{await load();}catch{source.value=null;error.value='Modification enregistrée. Rouvrez la publication pour continuer.';}else photos.value=[];
});}
</script>
<template>
  <div class="section member-page">
    <NuxtLink to="/mes-publications" class="breadcrumb">← Mes publications</NuxtLink>
    <h1>{{editing?'Modifier ma':'Créer une'}}<br><em>publication.</em></h1>
    <p class="page-intro">Décrivez votre idée ou les changements souhaités. L’assistant prépare une proposition à vérifier avant de l’enregistrer.</p>
    <div class="member-layout">
      <section class="member-panel member-form">
        <h2>1. Votre demande</h2>
        <p v-if="!status?.configured" class="member-notice">L’assistant est momentanément indisponible. Contactez le club pour préparer votre publication.</p>
        <p v-if="editing&&source" class="member-notice">Modification de « {{source.data.title}} ». Le brouillon enregistré sert de point de départ. Vos photos et documents sont conservés.</p>
        <form class="member-form" :aria-busy="!!busy" @submit.prevent="prepare">
          <label for="member-instruction">{{editing?'Que souhaitez-vous modifier ?':'Que souhaitez-vous partager ?'}}<textarea id="member-instruction" v-model="instruction" required maxlength="6000" rows="8" :disabled="!!busy||!interactive" :placeholder="editing?'Décale la sortie au 23 mai et précise qu’il faut apporter un casque.':'Une sortie falaise le 16 mai 2027, de 9 h à 17 h à Vertrieu. Prévoir un pique-nique.'" @input="invalidate"/></label>
          <p class="fine-print">Pour un rendez-vous, précisez la date, les horaires et le lieu. Seul le texte est envoyé à l’assistant, pas les photos.</p>
          <label v-if="!editing" for="member-photos">Photos (facultatif)<input id="member-photos" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple :disabled="!!busy||!interactive" @change="upload"></label>
          <p v-if="!editing" class="fine-print">JPEG, PNG, WebP ou AVIF. 30 photos maximum, 20 Mo par photo et 25 Mo par import.</p>
          <ul v-if="photos.length" class="member-photos"><li v-for="photo in photos" :key="photo.id"><img :src="photo.url" alt="" width="60" height="60"><span>{{photo.name}}</span><button v-if="!editing" type="button" :disabled="!!busy||!interactive" :aria-label="'Retirer '+photo.name" @click="invalidate();photos=photos.filter(item=>item.id!==photo.id)">Retirer</button></li></ul>
          <button type="submit" class="button button-dark member-prepare" :disabled="!!busy||!interactive||!status?.configured||!status?.canCreate||(editing&&!source)||!instruction.trim()">
            <span v-if="preparing" class="member-spinner" aria-hidden="true"/>
            {{preparing?'En attente de l’IA…':'Préparer la proposition'}}
          </button>
        </form>
      </section>
      <section class="member-panel" aria-labelledby="member-preview-title">
        <h2 id="member-preview-title">2. Vérifiez et confirmez</h2>
        <div v-if="busy" class="member-processing" role="status" aria-atomic="true">
          <span class="member-spinner" aria-hidden="true"/>
          <div>
            <strong>{{preparing?'L’IA prépare votre proposition…':busy}}</strong>
            <p v-if="preparing">Votre demande est en cours de traitement. La réponse peut prendre quelques dizaines de secondes.</p>
          </div>
        </div>
        <p v-if="error" class="member-error" role="alert">{{error}}</p>
        <div v-if="question" class="member-notice"><h3>Une précision est nécessaire</h3><p>{{question}}</p><p>Complétez votre demande puis préparez une nouvelle proposition.</p></div>
        <div v-if="preview">
          <section v-if="preview.original" class="member-before"><h3>Avant modification</h3><MemberPublicationPreview :publication="preview.original"/></section>
          <h3 v-if="editing">Proposition de modification</h3>
          <MemberPublicationPreview :publication="preview.data"/>
          <p>{{preview.data.photos?.length||0}} photo(s) jointe(s).</p>
          <p class="fine-print">Relisez les faits, les dates et les heures françaises. Aucune modification n’est enregistrée avant votre confirmation. L’aperçu expire après 15 minutes.</p>
          <div class="member-actions"><button type="button" class="button button-outline" :disabled="!!busy||!interactive" @click="confirm('draft')">Enregistrer le brouillon</button><button v-if="preview.canPublish" type="button" class="button button-dark" :disabled="!!busy||!interactive" @click="confirm('publish')">Confirmer et publier</button></div>
        </div>
        <div v-else-if="saved" class="member-success" role="status"><h3>{{saved.published?'Publication en ligne':'Brouillon enregistré'}}</h3><p>{{saved.title}}</p><NuxtLink to="/mes-publications">Retrouver mes publications</NuxtLink></div>
        <p v-else-if="!busy&&!question" class="fine-print">Votre proposition apparaîtra ici. Vous pourrez l’enregistrer en brouillon ou la publier.</p>
      </section>
    </div>
  </div>
</template>
