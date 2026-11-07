<script setup lang="ts">
import type {AlbumPhoto} from '#shared/gallery';
const props=defineProps<{photos:AlbumPhoto[]}>();
const route=useRoute();
const interactive=useInteractive();
const page=ref(1);
const selected=ref<number|null>(null);
const dialog=ref<HTMLDialogElement>();
const current=computed(()=>selected.value===null?null:props.photos[selected.value]);
const pages=computed(()=>Math.max(1,Math.ceil(props.photos.length/48)));
const visible=computed(()=>props.photos.slice((page.value-1)*48,page.value*48));
watch(selected,async value=>{await nextTick();if(value===null)dialog.value?.close();else if(!dialog.value?.open)dialog.value?.showModal();});
function previous(){if(selected.value!==null&&selected.value>0)selected.value--;}
function next(){if(selected.value!==null&&selected.value<props.photos.length-1)selected.value++;}
onMounted(()=>{
  const index=props.photos.findIndex(p=>route.query.legacyPhoto?p.legacyId===Number(route.query.legacyPhoto):p.id===Number(route.query.photo));
  if(index>=0)selected.value=index;
});
</script>
<template>
  <section v-if="photos.length" class="publication-gallery" aria-label="Photos de la publication">
    <h2>En <em>images.</em></h2><p>{{photos.length}} photo{{photos.length>1?'s':''}}</p>
    <div class="photo-grid" :class="{'single-photo':photos.length===1}">
      <button v-for="(photo,index) in visible" :key="photo.id" :disabled="!interactive" :aria-label="`Ouvrir la photo ${index+1+(page-1)*48} : ${photo.title}`" @click="selected=(page-1)*48+index">
        <img :src="photo.thumb" :alt="photo.title" loading="lazy" width="600" height="450">
      </button>
    </div>
    <nav v-if="pages>1" class="gallery-pagination" aria-label="Pages de photos"><button :disabled="page===1" @click="page--">← Précédente</button><span>{{page}} / {{pages}}</span><button :disabled="page===pages" @click="page++">Suivante →</button></nav>
    <dialog ref="dialog" class="photo-dialog" aria-label="Aperçu de la photo" @close="selected=null" @keydown.left="previous()" @keydown.right="next()">
      <template v-if="current"><div class="photo-controls"><span>{{selected!+1}} / {{photos.length}}</span><button aria-label="Fermer la photo" @click="selected=null">Fermer ×</button></div>
        <img :src="current.src" :alt="current.title" :width="current.width" :height="current.height">
        <div class="photo-controls"><button :disabled="selected===0" @click="previous()">← Précédente</button><a :href="current.src" :download="current.title">Télécharger l’original ↓</a><button :disabled="selected===photos.length-1" @click="next()">Suivante →</button></div><p>{{current.title}}</p>
      </template>
    </dialog>
  </section>
</template>
