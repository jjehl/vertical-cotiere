<script setup lang="ts">
const props=defineProps<{slug:string;photoId:number}>();
const emit=defineEmits<{deleted:[]}>();
const {api}=useMember();const interactive=useInteractive();
const confirming=ref(false);const busy=ref(false);const error=ref('');
async function remove() {
  if(busy.value)return;
  busy.value=true;error.value='';
  try {
    await api('/api/member/publications/'+encodeURIComponent(props.slug)+'/photos/'+props.photoId,{method:'DELETE'});
    emit('deleted');
  }catch(value){error.value=memberError(value);}
  finally{busy.value=false;}
}
</script>
<template>
  <div class="publication-photo-delete">
    <button v-if="!confirming" type="button" class="photo-delete" :disabled="!interactive" aria-label="Supprimer cette photo" @click="confirming=true">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5m4-5v5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Supprimer
    </button>
    <div v-else class="photo-delete-confirm">
      <span>Supprimer cette photo ?</span>
      <button type="button" class="photo-delete" :disabled="busy" @click="remove">{{busy?'Suppression…':'Confirmer'}}</button>
      <button type="button" class="photo-delete" :disabled="busy" @click="confirming=false;error=''">Annuler</button>
    </div>
    <p v-if="error" class="member-error" role="alert">{{error}}</p>
  </div>
</template>
