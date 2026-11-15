<script setup lang="ts">
import type {AssistantPublication} from '#shared/member';
import {dateLabel} from '#shared/dates';
defineProps<{publication:AssistantPublication;compact?:boolean}>();
const date=(value:string,allDay=false)=>dateLabel(value,allDay?{weekday:'long',day:'numeric',month:'long',year:'numeric'}:{weekday:'long',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});
</script>
<template>
  <div class="member-preview-content" :class="{'member-preview-content--compact':compact}">
    <div class="member-preview-copy">
      <span class="eyebrow">{{publication.category}}</span><h3>{{publication.title}}</h3><p v-if="publication.body" class="member-preview-text" :class="{'member-source-body':compact}" :tabindex="compact?0:undefined" :aria-label="compact?'Texte actuel de la publication':undefined">{{publication.body}}</p>
      <p v-else class="fine-print">Aucun texte.</p>
    </div>
    <dl v-if="publication.meeting" class="member-meeting">
      <dt>Début</dt><dd>{{date(publication.meeting.start,publication.meeting.allDay)}}{{publication.meeting.allDay?' · journée entière':''}}</dd>
      <template v-if="publication.meeting.end"><dt>Fin</dt><dd>{{date(publication.meeting.end,publication.meeting.allDay)}}</dd></template>
      <template v-if="publication.meeting.location"><dt>Lieu</dt><dd>{{publication.meeting.location}}</dd></template>
      <dt>État</dt><dd>{{publication.meeting.eventState}}</dd>
      <template v-if="publication.meeting.deadline"><dt>Clôture</dt><dd>{{date(publication.meeting.deadline)}}</dd></template>
      <template v-if="publication.meeting.participationUrl"><dt>Participation</dt><dd><a :href="publication.meeting.participationUrl" target="_blank" rel="noopener noreferrer">{{publication.meeting.participationLabel||publication.meeting.participationUrl}}</a></dd></template>
    </dl>
    <p v-else>Sans rendez-vous dans l’agenda.</p>
  </div>
</template>
