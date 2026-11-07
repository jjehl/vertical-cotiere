<script setup lang="ts">
import {dateLabel,eventDateLabel,canParticipate} from '#shared/dates';
const route=useRoute();
const {data:publication,error,refresh}=await useFetch(`/api/publications/${encodeURIComponent(String(route.params.slug))}`);
if(error.value?.statusCode===404)throw createError({statusCode:404,statusMessage:'Publication introuvable'});
const meeting=computed(()=>publication.value?.meeting);
const photos=computed(()=>publication.value?.photos.filter(p=>!publication.value?.bodyHtml.includes(p.src+'"')&&!publication.value?.bodyHtml.includes(p.src+"'"))||[]);
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
          <PublicationGallery :photos="photos"/>
          <ContentAttachments :files="publication.attachments" :html="publication.bodyHtml"/>
        </div>
        <aside v-if="meeting" class="event-aside">
          <span class="eyebrow">Le rendez-vous</span><h2>{{eventDateLabel(meeting)}}</h2>
          <p v-if="meeting.allDay">Toute la journée</p><p v-else>{{dateLabel(meeting.start,{hour:'2-digit',minute:'2-digit'})}}<template v-if="meeting.end!==meeting.start"> – {{dateLabel(meeting.end,{hour:'2-digit',minute:'2-digit'})}}</template></p>
          <p v-if="meeting.location">{{meeting.location}}</p><span class="pill">{{meeting.eventState}}</span>
          <a v-if="canParticipate(meeting)" :href="meeting.participationUrl" class="button button-orange" target="_blank" rel="noopener noreferrer">{{meeting.participationLabel||'Participer'}} <ArrowIcon/></a>
          <p v-else-if="meeting.participationUrl">Les participations sont closes.</p>
          <p v-if="meeting.deadline" class="fine-print">Avant le {{dateLabel(meeting.deadline)}}</p>
          <a :href="`/api/agenda.ics?evenement=${encodeURIComponent(publication.slug)}`" class="text-link" download>Ajouter à mon calendrier <ArrowIcon/></a>
          <NuxtLink to="/agenda" class="text-link">Voir l’agenda <ArrowIcon/></NuxtLink>
        </aside>
      </div>
    </article>
  </div>
</template>
