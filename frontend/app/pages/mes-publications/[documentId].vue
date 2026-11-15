<script setup lang="ts">
definePageMeta({middleware:'member',contributor:true});
const route=useRoute();
const documentId=computed(()=>String(route.params.documentId));
useSeoMeta({title:'Modifier ma publication — Vertical Côtière',robots:'noindex, nofollow'});
</script>
<template><MemberAssistant :key="documentId" :document-id="documentId"/></template>
