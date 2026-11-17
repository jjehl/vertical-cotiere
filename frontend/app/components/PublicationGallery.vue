<script setup lang="ts">
import type {AlbumPhoto} from '#shared/gallery';
const props=defineProps<{photos:AlbumPhoto[];showEmpty?:boolean;canReorder?:boolean;savingOrder?:boolean;orderError?:string}>();
const emit=defineEmits<{reorder:[ids:number[]];reordering:[active:boolean]}>();
const route=useRoute();
const interactive=useInteractive();
const page=ref(1);
const selected=ref<number|null>(null);
const dialog=ref<HTMLDialogElement>();
const draftOrder=ref<AlbumPhoto[]|null>(null);
const dragging=ref<number|null>(null);const dropTarget=ref<number|null>(null);
const orderedPhotos=computed(()=>draftOrder.value||props.photos);
const current=computed(()=>selected.value===null?null:orderedPhotos.value[selected.value]);
const pages=computed(()=>Math.max(1,Math.ceil(orderedPhotos.value.length/48)));
const visible=computed(()=>orderedPhotos.value.slice((page.value-1)*48,page.value*48));
const orderChanged=computed(()=>draftOrder.value?.some((photo,index)=>photo.id!==props.photos[index]?.id));
function editOrder(){selected.value=null;draftOrder.value=[...props.photos];emit('reordering',true);}
function cancelOrder(){draftOrder.value=null;dragging.value=null;dropTarget.value=null;emit('reordering',false);}
function openPhoto(index:number){if(!draftOrder.value)selected.value=(page.value-1)*48+index;}
function movePhoto(id:number,to:number){
  if(!draftOrder.value||props.savingOrder)return;
  const from=draftOrder.value.findIndex(photo=>photo.id===id);
  if(from<0||to<0||to>=draftOrder.value.length||from===to)return;
  const updated=[...draftOrder.value];const [photo]=updated.splice(from,1);updated.splice(to,0,photo!);draftOrder.value=updated;
  page.value=Math.floor(to/48)+1;
}
function dragStart(event:DragEvent,id:number){
  if(props.savingOrder||!draftOrder.value){event.preventDefault();return;}
  dragging.value=id;
  if(event.dataTransfer){event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',String(id));}
}
function dragOver(event:DragEvent,id:number){
  if(dragging.value===null||props.savingOrder)return;
  event.preventDefault();dropTarget.value=id;if(event.dataTransfer)event.dataTransfer.dropEffect='move';
}
function dropPhoto(event:DragEvent,id:number){
  if(dragging.value===null||!draftOrder.value)return;
  event.preventDefault();movePhoto(dragging.value,draftOrder.value.findIndex(photo=>photo.id===id));dragging.value=null;dropTarget.value=null;
}
watch(()=>props.savingOrder,(saving,previous)=>{if(previous&&!saving&&!props.orderError)cancelOrder();});
watch(()=>props.canReorder,allowed=>{if(!allowed)cancelOrder();});
watch(selected,async value=>{await nextTick();if(value===null)dialog.value?.close();else if(!dialog.value?.open)dialog.value?.showModal();});
watch(()=>props.photos,(photos,previousPhotos)=>{
  page.value=Math.min(page.value,pages.value);
  if(selected.value===null)return;
  const id=previousPhotos[selected.value]?.id;
  const index=photos.findIndex(photo=>photo.id===id);selected.value=index<0?null:index;
});
function previous(){if(selected.value!==null&&selected.value>0)selected.value--;}
function next(){if(selected.value!==null&&selected.value<orderedPhotos.value.length-1)selected.value++;}
onMounted(()=>{
  const index=props.photos.findIndex(p=>route.query.legacyPhoto?p.legacyId===Number(route.query.legacyPhoto):p.id===Number(route.query.photo));
  if(index>=0)selected.value=index;
});
</script>
<template>
  <section v-if="photos.length||showEmpty" class="publication-gallery" aria-label="Photos de la publication">
    <div class="publication-gallery-heading"><h2>En <em>images.</em></h2><div class="publication-gallery-actions"><button v-if="canReorder&&photos.length>1&&!draftOrder" type="button" class="button publication-add-photos" :disabled="!interactive" @click="editOrder">Réorganiser les photos</button><slot name="actions"/></div></div>
    <div v-if="draftOrder" class="photo-order-toolbar" :aria-busy="savingOrder">
      <p>Glissez les photos pour les déplacer, ou utilisez les boutons sous chaque image.</p>
      <div class="photo-order-actions"><button type="button" class="button button-dark" :disabled="savingOrder||!orderChanged" @click="emit('reorder',draftOrder.map(photo=>photo.id))">{{savingOrder?'Enregistrement…':'Enregistrer l’ordre'}}</button><button type="button" class="button button-outline" :disabled="savingOrder" @click="cancelOrder">Annuler</button></div>
      <p v-if="orderError" class="member-error" role="alert">{{orderError}}</p>
    </div>
    <p v-if="photos.length">{{photos.length}} photo{{photos.length>1?'s':''}}</p>
    <p v-else class="fine-print">Partagez les premières photos de cette publication.</p>
    <div class="photo-grid" :class="{'single-photo':photos.length===1}">
      <figure v-for="(photo,index) in visible" :key="photo.id" :draggable="!!draftOrder&&!savingOrder" :class="{'photo-order-item':draftOrder,'photo-order-dragging':dragging===photo.id,'photo-order-target':dropTarget===photo.id&&dragging!==photo.id}" @dragstart="dragStart($event,photo.id)" @dragend="dragging=null;dropTarget=null" @dragover="dragOver($event,photo.id)" @drop="dropPhoto($event,photo.id)">
        <button :disabled="!interactive||savingOrder" :aria-label="`${draftOrder?'Déplacer':'Ouvrir'} la photo ${index+1+(page-1)*48} : ${photo.title}`" @click="openPhoto(index)">
          <img :src="photo.thumb" :alt="photo.title" :draggable="false" loading="lazy" width="600" height="450">
        </button>
        <div v-if="draftOrder" class="photo-order-controls" role="group" :aria-label="`Position de la photo : ${photo.title}`">
          <button type="button" class="photo-order-handle" :draggable="!savingOrder" :disabled="savingOrder" :aria-label="`Glisser la photo : ${photo.title}`">⠿ <span>{{index+1+(page-1)*48}}</span></button>
          <button type="button" :disabled="savingOrder||index+(page-1)*48===0" :aria-label="`Avancer la photo : ${photo.title}`" @click="movePhoto(photo.id,index+(page-1)*48-1)">←</button>
          <button type="button" :disabled="savingOrder||index+(page-1)*48===photos.length-1" :aria-label="`Reculer la photo : ${photo.title}`" @click="movePhoto(photo.id,index+(page-1)*48+1)">→</button>
          <button type="button" :disabled="savingOrder||index+(page-1)*48===0" :aria-label="`Mettre en premier : ${photo.title}`" @click="movePhoto(photo.id,0)">En premier</button>
        </div>
        <figcaption v-if="photo.addedBy||$slots['photo-actions']" class="photo-meta">
          <span v-if="photo.addedBy" class="photo-attribution">Ajouté par {{photo.addedBy}}</span>
          <slot name="photo-actions" :photo="photo"/>
        </figcaption>
      </figure>
    </div>
    <nav v-if="pages>1" class="gallery-pagination" aria-label="Pages de photos"><button :disabled="page===1" @click="page--">← Précédente</button><span>{{page}} / {{pages}}</span><button :disabled="page===pages" @click="page++">Suivante →</button></nav>
    <dialog ref="dialog" class="photo-dialog" aria-label="Aperçu de la photo" @close="selected=null" @keydown.left="previous()" @keydown.right="next()">
      <template v-if="current"><div class="photo-controls"><span>{{selected!+1}} / {{photos.length}}</span><button aria-label="Fermer la photo" @click="selected=null">Fermer ×</button></div>
        <img :src="current.src" :alt="current.title" :width="current.width" :height="current.height">
        <div class="photo-controls"><button :disabled="selected===0" @click="previous()">← Précédente</button><a :href="current.src" :download="current.title">Télécharger l’original ↓</a><button :disabled="selected===photos.length-1" @click="next()">Suivante →</button></div><p>{{current.title}}</p>
        <p v-if="current.addedBy" class="photo-attribution">Ajouté par {{current.addedBy}}</p>
        <slot name="photo-actions" :photo="current"/>
      </template>
    </dialog>
  </section>
</template>
