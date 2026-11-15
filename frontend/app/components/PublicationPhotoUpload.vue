<script setup lang="ts">
import type {MemberPhoto} from '#shared/member';
const props=defineProps<{slug:string}>();
const emit=defineEmits<{uploaded:[]}>();
const {api}=useMember();
const interactive=useInteractive();
const input=ref<HTMLInputElement>();const busy=ref(false);const error=ref('');const message=ref('');
async function upload(event:Event) {
  const target=event.target as HTMLInputElement;
  const files=Array.from(target.files||[]);target.value='';
  if(busy.value||!files.length)return;
  error.value='';message.value='';
  if(files.length>30){error.value='Sélectionnez au maximum 30 photos à la fois.';return;}
  if(files.some(file=>file.size>20*1024*1024)||files.reduce((sum,file)=>sum+file.size,0)>25*1024*1024){error.value='20 Mo maximum par photo et 25 Mo par import.';return;}
  busy.value=true;
  try {
    const body=new FormData();files.forEach(file=>body.append('files',file));
    const added=await api<MemberPhoto[]>('/api/member/publications/'+encodeURIComponent(props.slug)+'/photos',{method:'POST',body});
    message.value=added.length===1?'Votre photo a été ajoutée.':`${added.length} photos ont été ajoutées.`;
    emit('uploaded');
  }catch(value){error.value=memberError(value);}
  finally{busy.value=false;}
}
</script>
<template>
  <div class="publication-photo-upload">
    <input ref="input" type="file" hidden accept="image/jpeg,image/png,image/webp,image/avif" multiple :disabled="busy||!interactive" aria-label="Choisir des photos à ajouter à la publication" @change="upload">
    <button type="button" class="button publication-add-photos" :disabled="busy||!interactive" @click="input?.click()">
      <span v-if="busy" class="member-spinner" aria-hidden="true"/>
      <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 4H4v16h16V10M16 4h6m-3-3v6M4 16l5-5 7 9m-3-5 3-3 4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      {{busy?'Ajout des photos…':'Ajouter des photos'}}
    </button>
    <p class="fine-print">JPEG, PNG, WebP ou AVIF · 20 Mo par photo, 25 Mo par import.</p>
    <p role="status">{{busy?'Vos photos sont en cours d’envoi…':message}}</p>
    <p v-if="error" class="member-error" role="alert">{{error}}</p>
  </div>
</template>
