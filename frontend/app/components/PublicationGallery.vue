<script setup lang="ts">
import type {AlbumPhoto} from '#shared/gallery';
const props=defineProps<{photos:AlbumPhoto[];showEmpty?:boolean}>();
const route=useRoute();
const interactive=useInteractive();
const page=ref(1);
const selected=ref<number|null>(null);
const dialog=ref<HTMLDialogElement>();
const current=computed(()=>selected.value===null?null:props.photos[selected.value]);
const pages=computed(()=>Math.max(1,Math.ceil(props.photos.length/48)));
const visible=computed(()=>props.photos.slice((page.value-1)*48,page.value*48));
watch(selected,async value=>{await nextTick();if(value===null)dialog.value?.close();else if(!dialog.value?.open)dialog.value?.showModal();});
watch(()=>props.photos,(photos,previousPhotos)=>{
  page.value=Math.min(page.value,pages.value);
  if(selected.value===null)return;
  const id=previousPhotos[selected.value]?.id;
  const index=photos.findIndex(photo=>photo.id===id);selected.value=index<0?null:index;
});
function previous(){if(selected.value!==null&&selected.value>0)selected.value--;}
function next(){if(selected.value!==null&&selected.value<props.photos.length-1)selected.value++;}
onMounted(()=>{
  const index=props.photos.findIndex(p=>route.query.legacyPhoto?p.legacyId===Number(route.query.legacyPhoto):p.id===Number(route.query.photo));
  if(index>=0)selected.value=index;
});
</script>
<template>
  <section v-if="photos.length||showEmpty" class="publication-gallery" aria-label="Photos de la publication">
    <div class="publication-gallery-heading"><h2>En <em>images.</em></h2><slot name="actions"/></div>
    <p v-if="photos.length">{{photos.length}} photo{{photos.length>1?'s':''}}</p>
    <p v-else class="fine-print">Partagez les premières photos de cette publication.</p>
    <div class="photo-grid" :class="{'single-photo':photos.length===1}">
      <figure v-for="(photo,index) in visible" :key="photo.id">
        <button :disabled="!interactive" :aria-label="`Ouvrir la photo ${index+1+(page-1)*48} : ${photo.title}`" @click="selected=(page-1)*48+index">
          <img :src="photo.thumb" :alt="photo.title" loading="lazy" width="600" height="450">
        </button>
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
