<script setup lang="ts">
import type {MemberPublication} from '#shared/member';
definePageMeta({middleware:'member',contributor:true});
const {api}=useMember();
const {data,error,refresh}=await useAsyncData('my-publications',()=>api<MemberPublication[]>('/api/member/publications'),{default:()=>[]});
useSeoMeta({title:'Mes publications — Vertical Côtière',robots:'noindex, nofollow'});
</script>
<template>
  <div class="section member-page">
    <span class="eyebrow">L’esprit du club se partage</span><h1>Mes<br><em>publications.</em></h1>
    <nav class="member-actions" aria-label="Mes publications"><NuxtLink to="/mes-publications/nouvelle" class="button button-dark">Créer avec l’assistant IA <ArrowIcon/></NuxtLink><NuxtLink to="/compte" class="text-link">Mon profil</NuxtLink></nav>
    <ContentState :error="error" @retry="refresh()"/>
    <p v-if="!error&&!data.length" class="member-panel">Vous n’avez pas encore de publication. Racontez une sortie, annoncez un rendez-vous ou partagez les photos du club.</p>
    <ul v-else class="member-publications">
      <li v-for="item in data" :key="item.documentId" class="member-panel">
        <span class="eyebrow">{{item.published?'Version en ligne':'Brouillon'}} · {{item.category}}</span>
        <h2>{{item.title}}</h2>
        <p class="member-preview-text">{{item.body}}</p>
        <div class="member-publication-links">
          <NuxtLink v-if="item.url" :to="item.url" class="text-link">Voir la publication <ArrowIcon/></NuxtLink>
          <NuxtLink :to="'/mes-publications/'+item.documentId" class="text-link">Modifier avec l’assistant IA <ArrowIcon/></NuxtLink>
        </div>
      </li>
    </ul>
  </div>
</template>
