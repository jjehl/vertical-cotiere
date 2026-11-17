<script setup lang="ts">
import {dateLabel,eventDateLabel,canParticipate} from '#shared/dates';
const route=useRoute();
const {profile,api,refresh:refreshMember}=useMember();
const memberReady=ref(false);
const ownPhotoIds=ref<number[]>([]);const photoMessage=ref('');
const canReorderPhotos=ref(false);const reordering=ref(false);const savingOrder=ref(false);const orderError=ref('');
const canAddPhotos=computed(()=>memberReady.value&&(profile.value?.role==='contributor'||profile.value?.role==='admin'));
async function refreshPhotoOwnership(){
  if(!profile.value){ownPhotoIds.value=[];canReorderPhotos.value=false;return;}
  try{const access=await api<{ids:number[];canReorder:boolean}>('/api/member/publications/'+encodeURIComponent(String(route.params.slug))+'/photos');ownPhotoIds.value=access.ids;canReorderPhotos.value=access.canReorder;}
  catch{ownPhotoIds.value=[];canReorderPhotos.value=false;}
}
onMounted(async()=>{try{await refreshMember();await refreshPhotoOwnership();}catch{}finally{memberReady.value=true;}});
const {data:publication,error,refresh}=await useFetch(`/api/publications/${encodeURIComponent(String(route.params.slug))}`);
if(error.value?.statusCode===404)throw createError({statusCode:404,statusMessage:'Publication introuvable'});
const meeting=computed(()=>publication.value?.meeting);
const photos=computed(()=>publication.value?.photos.filter(p=>!publication.value?.bodyHtml.includes(p.src+'"')&&!publication.value?.bodyHtml.includes(p.src+"'"))||[]);
async function refreshPhotos(){await refresh();await refreshPhotoOwnership();}
async function photoDeleted(){photoMessage.value='Votre photo a été supprimée.';await refreshPhotos();}
function setReordering(active:boolean){reordering.value=active;orderError.value='';if(active)photoMessage.value='';}
async function savePhotoOrder(ids:number[]){
  if(savingOrder.value||!publication.value)return;
  savingOrder.value=true;orderError.value='';photoMessage.value='';
  const previousIds=publication.value.photos.map(photo=>photo.id);
  const visibleIds=new Set(photos.value.map(photo=>photo.id));let index=0;
  const completeOrder=previousIds.map(id=>visibleIds.has(id)?ids[index++]!:id);
  try{
    await api('/api/member/publications/'+encodeURIComponent(publication.value.slug)+'/photos',{method:'PUT',body:{ids:completeOrder,previousIds}});
    await refreshPhotos();photoMessage.value='L’ordre des photos a été enregistré.';
  }catch(value){orderError.value=memberError(value);}
  finally{savingOrder.value=false;}
}
useSeoMeta({title:()=>`${publication.value?.title||'La vie du club'} — Vertical Côtière`,description:()=>publication.value?.summary});
</script>
<template>
  <div class="section article-page publication-page">
    <ContentState :error="error" @retry="refresh()"/>
    <article v-if="publication">
      <NuxtLink to="/vie-du-club" class="breadcrumb">← La vie du club</NuxtLink>
      <span class="eyebrow"><template v-if="publication.date">{{dateLabel(publication.date)}}</template><template v-else>Archives du club</template></span>
      <h1>{{publication.title}}</h1>
      <div :class="{'event-detail-layout':meeting}">
        <div class="publication-content">
          <img v-if="publication.image&&!publication.photos.length" class="article-cover" :src="publication.image" :alt="publication.imageAlt" :style="{objectPosition:publication.imagePosition}" width="1200" height="700">
          <ImportedContent v-if="publication.bodyHtml" :html="publication.bodyHtml"/>
          <div v-else class="prose publication-text"><p v-for="(paragraph,i) in publication.body.split('\n\n')" :key="i">{{paragraph}}</p></div>
          <PublicationGallery :photos="photos" :show-empty="canAddPhotos" :can-reorder="canReorderPhotos" :saving-order="savingOrder" :order-error="orderError" @reorder="savePhotoOrder" @reordering="setReordering">
            <template #actions><PublicationPhotoUpload v-if="canAddPhotos&&!reordering" :slug="publication.slug" @uploaded="photoMessage='';refreshPhotos()"/></template>
            <template #photo-actions="{photo}"><PublicationPhotoDelete v-if="!reordering&&ownPhotoIds.includes(photo.id)" :key="photo.id" :slug="publication.slug" :photo-id="photo.id" @deleted="photoDeleted"/></template>
          </PublicationGallery>
          <p v-if="photoMessage" class="fine-print" role="status">{{photoMessage}}</p>
          <ContentAttachments :files="publication.attachments" :html="publication.bodyHtml"/>
        </div>
        <aside v-if="meeting" class="event-aside">
          <PublicationParticipation :key="publication.slug" :slug="publication.slug" :member-ready="memberReady" :has-poll="publication.hasParticipationPoll">
          <div class="event-meeting-details">
          <h2>{{eventDateLabel(meeting)}}</h2>
          <p v-if="meeting.allDay">Toute la journée</p><p v-else>{{dateLabel(meeting.start,{hour:'2-digit',minute:'2-digit'})}}<template v-if="meeting.end!==meeting.start"> – {{dateLabel(meeting.end,{hour:'2-digit',minute:'2-digit'})}}</template></p>
          <p v-if="meeting.location">{{meeting.location}}</p><span v-if="meeting.eventState!=='prévu'" class="pill">{{meeting.eventState}}</span>
          </div>
          <a v-if="canParticipate(meeting)" :href="meeting.participationUrl" class="button button-orange" target="_blank" rel="noopener noreferrer">{{meeting.participationLabel||'Participer'}} <ArrowIcon/></a>
          <p v-else-if="meeting.participationUrl">Les participations sont closes.</p>
          <p v-if="meeting.deadline" class="fine-print">Avant le {{dateLabel(meeting.deadline)}}</p>
          <nav class="event-secondary-links" aria-label="Calendrier du rendez-vous">
            <a :href="`/api/agenda.ics?evenement=${encodeURIComponent(publication.slug)}`" download>Ajouter à mon calendrier</a>
            <NuxtLink to="/agenda">Voir l’agenda</NuxtLink>
          </nav>
          </PublicationParticipation>
        </aside>
      </div>
    </article>
  </div>
</template>
