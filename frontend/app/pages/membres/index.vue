<script setup lang="ts">
import type {MemberDirectory} from '#shared/member-directory';
import {memberRoleLabels,memberAccountStatus,directoryDate} from '#shared/member-directory';
definePageMeta({middleware:'member',memberAdmin:true});
const {api}=useMember();
const interactive=useInteractive();
const search=ref('');
const filters=reactive({q:'',role:'',status:'',sort:'lastName',direction:'asc',page:1,pageSize:25});
const columns=[{key:'lastName',label:'Nom'},{key:'firstName',label:'Prénom'},{key:'email',label:'E-mail'},{key:'phone',label:'Téléphone'},{key:'city',label:'Ville'},{key:'ffmeLicenseNumber',label:'Licence FFME'},{key:'role',label:'Rôle'},{key:'createdAt',label:'Création du compte'}];
const {data,error,status,refresh}=await useAsyncData('member-directory',()=>api<MemberDirectory>('/api/member/directory',{query:{...filters}}),{watch:[()=>({...filters})]});
// Discard previously displayed personal data if access is revoked or a request fails.
const result=computed(()=>error.value?null:data.value);
const busy=computed(()=>status.value==='pending');
function applySearch(){filters.q=search.value.trim();filters.page=1;}
function sortBy(key:string){filters.direction=filters.sort===key&&filters.direction==='asc'?'desc':'asc';filters.sort=key;filters.page=1;}
function reset(){search.value='';Object.assign(filters,{q:'',role:'',status:'',sort:'lastName',direction:'asc',page:1,pageSize:25});}
useSeoMeta({title:'Liste des membres — Vertical Côtière',robots:'noindex, nofollow'});
</script>
<template>
  <div class="section member-page member-directory">
    <span class="eyebrow">Administration des membres</span><h1>Les membres<br><em>du club.</em></h1>
    <nav class="member-actions" aria-label="Administration des membres"><NuxtLink to="/compte" class="text-link">Mon profil</NuxtLink><NuxtLink to="/mes-publications" class="text-link">Mes publications</NuxtLink></nav>
    <form class="member-panel directory-filters member-form" @submit.prevent="applySearch">
      <label for="directory-search">Rechercher un membre<input id="directory-search" v-model="search" type="search" maxlength="120" placeholder="Nom, e-mail, téléphone, ville, licence…" :disabled="!interactive"></label>
      <label for="directory-role">Rôle<select id="directory-role" v-model="filters.role" :disabled="!interactive" @change="filters.page=1"><option value="">Tous les rôles</option><option v-for="(label,key) in memberRoleLabels" :key="key" :value="key">{{label}}</option></select></label>
      <label for="directory-status">État du compte<select id="directory-status" v-model="filters.status" :disabled="!interactive" @change="filters.page=1"><option value="">Tous les états</option><option value="active">Actif</option><option value="unconfirmed">À confirmer</option><option value="blocked">Bloqué</option></select></label>
      <button class="button button-dark" type="submit" :disabled="!interactive||busy">Rechercher</button><button type="button" class="text-link" :disabled="!interactive||busy" @click="reset">Réinitialiser</button>
    </form>
    <p v-if="error" class="member-error" role="alert">{{memberError(error)}} <button type="button" class="text-link" @click="refresh()">Réessayer</button></p>
    <p v-if="busy" role="status">Chargement des membres…</p>
    <template v-if="result">
      <p role="status">{{result.pagination.total}} membre{{result.pagination.total>1?'s':''}}<span v-if="filters.q"> pour « {{filters.q}} »</span>.</p>
      <div v-if="result.members.length" class="directory-table-wrap" tabindex="0" role="region" aria-label="Liste des membres, tableau défilant" :aria-busy="busy">
        <table class="directory-table"><caption class="sr-only">Membres du club. Cliquez sur un en-tête pour trier ou sur un nom pour consulter sa fiche.</caption>
          <thead><tr><th v-for="column in columns" :key="column.key" scope="col" :aria-sort="filters.sort===column.key?(filters.direction==='asc'?'ascending':'descending'):'none'"><button type="button" :disabled="!interactive||busy" @click="sortBy(column.key)">{{column.label}} <span aria-hidden="true">{{filters.sort===column.key?(filters.direction==='asc'?'↑':'↓'):'↕'}}</span></button></th><th scope="col">État</th><th scope="col"><span class="sr-only">Fiche</span></th></tr></thead>
          <tbody><tr v-for="item in result.members" :key="item.id"><td><NuxtLink :to="'/membres/'+item.id" class="text-link">{{item.lastName||item.username}}</NuxtLink></td><td>{{item.firstName||'—'}}</td><td>{{item.email}}</td><td>{{item.phone||'—'}}</td><td>{{item.city||'—'}}</td><td>{{item.ffmeLicenseNumber||'—'}}</td><td>{{memberRoleLabels[item.role]}}</td><td>{{directoryDate(item.createdAt)}}</td><td><span class="directory-badge" :class="{'directory-badge-alert':item.blocked}">{{memberAccountStatus(item)}}</span></td><td><NuxtLink :to="'/membres/'+item.id" class="text-link" :aria-label="'Consulter la fiche de '+item.firstName+' '+item.lastName">Consulter <ArrowIcon/></NuxtLink></td></tr></tbody>
        </table>
      </div>
      <p v-else class="member-panel">Aucun membre ne correspond à ces critères.</p>
      <nav class="directory-pagination" aria-label="Pagination des membres">
        <button type="button" class="button" :disabled="filters.page<=1||busy||!interactive" @click="filters.page--">Précédent</button>
        <span>Page {{result.pagination.page}} sur {{result.pagination.pageCount||1}}</span>
        <button type="button" class="button" :disabled="filters.page>=result.pagination.pageCount||busy||!interactive" @click="filters.page++">Suivant</button>
        <label for="directory-page-size">Par page <select id="directory-page-size" v-model.number="filters.pageSize" :disabled="!interactive||busy" @change="filters.page=1"><option :value="25">25</option><option :value="50">50</option><option :value="100">100</option></select></label>
      </nav>
    </template>
  </div>
</template>
