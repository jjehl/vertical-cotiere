<script setup lang="ts">
import type {DirectoryProfileInput,MemberDetails} from '#shared/member-directory';
import {memberRoleLabels,memberAccountStatus,directoryDate,directoryPersonName,validityDateFields} from '#shared/member-directory';
definePageMeta({middleware:'member',memberAdmin:true,key:route=>route.path});
const route=useRoute();const {api,profile,refresh:refreshProfile}=useMember();
const id=String(route.params.id);
const {data,error,status,refresh}=await useAsyncData('member-details-'+id,()=>api<MemberDetails>('/api/member/directory/'+encodeURIComponent(id)));
const details=computed(()=>error.value?null:data.value);
const member=computed(()=>details.value?.member);
const editing=ref(false);
const deleting=ref(false);
const actionError=ref('');
const notice=ref('');
async function saveMember(input:DirectoryProfileInput){
  await api('/api/member/directory/'+id,{method:'PUT',body:input});
  editing.value=false;notice.value='Fiche enregistrée.';
  await refresh();
  if(profile.value?.id===Number(id))await refreshProfile();
}
async function deleteMember(){
  if(!member.value||deleting.value)return;
  if(!window.confirm('Supprimer définitivement la fiche de '+directoryPersonName(member.value)+' et tous ses liens familiaux ?'))return;
  deleting.value=true;actionError.value='';
  try{
    await api('/api/member/directory/'+id,{method:'DELETE'});
    await navigateTo('/membres',{replace:true});
  }catch(cause){actionError.value=memberError(cause);}
  finally{deleting.value=false;}
}
const courses=computed(()=>details.value?.registrations.filter(item=>item.isParticipant)||[]);
const payments=computed(()=>details.value?.registrations.filter(item=>item.isPayer&&!item.isParticipant)||[]);
const contactFields=[{key:'email',label:'E-mail'},{key:'phone',label:'Téléphone'},{key:'street',label:'Adresse'},{key:'postalCode',label:'Code postal'},{key:'city',label:'Ville'},{key:'country',label:'Pays'},{key:'ffmeLicenseNumber',label:'Licence FFME'}] as const;
useSeoMeta({title:'Fiche membre — Vertical Côtière',robots:'noindex, nofollow'});
</script>
<template>
  <div class="section member-page">
    <NuxtLink to="/membres" class="breadcrumb">← Liste des membres</NuxtLink>
    <span class="eyebrow">Fiche membre</span><h1>{{member?.firstName||'Fiche'}}<br><em>{{member?.lastName||(member?.provider==='contact'?'contact':'membre')}}.</em></h1>
    <p v-if="status==='pending'" role="status">Chargement de la fiche…</p>
    <p v-if="error" class="member-error" role="alert">{{memberError(error)}} <MemberActionButton tone="quiet" @click="refresh()">Réessayer</MemberActionButton></p>
    <template v-if="details&&member">
      <div v-if="!editing" class="directory-controls directory-profile-actions">
        <MemberActionButton tone="primary" icon="edit" :disabled="deleting" @click="editing=true;notice='';actionError=''">Modifier la fiche</MemberActionButton>
        <MemberActionButton tone="danger" icon="trash" v-if="member.id!==profile?.id" :disabled="deleting" @click="deleteMember">Supprimer la fiche</MemberActionButton>
      </div>
      <MemberDirectoryForm v-if="editing" :member="member" :can-edit-email="details.canEditEmail" title="Modifier la fiche" :save="saveMember" @cancel="editing=false"/>
      <p v-if="actionError" class="member-error" role="alert">{{actionError}}</p>
      <p v-if="notice" role="status">{{notice}}</p>
      <div class="member-layout">
        <section class="member-panel"><h2>Coordonnées et identité</h2><dl class="directory-details"><dt>Prénom</dt><dd>{{member.firstName||'Non renseigné'}}</dd><dt>Nom</dt><dd>{{member.lastName||'Non renseigné'}}</dd><dt>Date de naissance</dt><dd>{{directoryDate(member.membershipBirthDate)}}</dd><template v-for="field in contactFields" :key="field.key"><dt>{{field.label}}</dt><dd>{{member[field.key]||'Non renseigné'}}</dd></template>
          <template v-for="field in validityDateFields" :key="field.key"><dt>{{field.label}}</dt><dd>{{directoryDate(member[field.key])}}</dd></template>
          <dt>Compétiteur</dt><dd>{{member.competition?'Oui':'Non'}}</dd></dl></section>
        <section class="member-panel"><h2>Compte membre</h2><dl class="directory-details"><dt>Identifiant</dt><dd>{{member.username}}</dd><dt>Rôle</dt><dd>{{memberRoleLabels[member.role]}}</dd><dt>État</dt><dd>{{memberAccountStatus(member)}}</dd><dt>E-mail confirmé</dt><dd>{{member.confirmed?'Oui':'Non'}}</dd><dt>Compte créé le</dt><dd>{{directoryDate(member.createdAt)}}</dd><dt>Dernière modification</dt><dd>{{directoryDate(member.updatedAt)}}</dd><dt>Invitation d’activation envoyée le</dt><dd>{{directoryDate(member.registrationInviteSentAt)}}</dd></dl></section>
      </div>
      <section class="directory-section member-panel">
        <h2>Liens familiaux</h2>
        <MemberFamilyLinks :subject-id="member.id" relation="guardians" :people="details.guardians" @changed="refresh()"/>
        <MemberFamilyLinks :subject-id="member.id" relation="dependents" :people="details.dependents" @changed="refresh()"/>
        <template v-if="details.secondGuardianContact">
          <h3>Responsable 2 · coordonnées du classeur à vérifier</h3>
          <dl class="directory-details">
            <template v-if="details.secondGuardianContact.email"><dt>E-mail</dt><dd>{{details.secondGuardianContact.email}}</dd></template>
            <template v-if="details.secondGuardianContact.phone"><dt>Téléphone</dt><dd>{{details.secondGuardianContact.phone}}</dd></template>
          </dl>
        </template>
      </section>
      <section class="directory-section" aria-labelledby="member-courses"><h2 id="member-courses">Cours et paiements <span>({{courses.length}})</span></h2><p>Historique de toutes les saisons. Les informations du dossier conservent les coordonnées saisies lors de l’inscription.</p><p v-if="!courses.length" class="member-panel">Aucune inscription à un cours rattachée à ce compte.</p><ul v-else class="member-publications"><li v-for="registration in courses" :key="registration.id" class="member-panel"><MemberRegistrationDetails :registration="registration"/></li></ul></section>
      <section class="directory-section" aria-labelledby="member-payments"><h2 id="member-payments">Dossiers de paiement pour d’autres adhérents <span>({{payments.length}})</span></h2><p v-if="!payments.length" class="member-panel">Aucun dossier pour un autre adhérent.</p><ul v-else class="member-publications"><li v-for="registration in payments" :key="registration.id" class="member-panel"><MemberRegistrationDetails :registration="registration"/></li></ul></section>
      <section class="directory-section" aria-labelledby="member-events"><h2 id="member-events">Participations aux événements <span>({{details.participations.length}})</span></h2><p v-if="!details.participations.length" class="member-panel">Aucune participation enregistrée.</p><ul v-else class="member-publications"><li v-for="participation in details.participations" :key="participation.id" class="member-panel"><h3><NuxtLink v-if="participation.url" :to="participation.url" class="text-link">{{participation.title}}</NuxtLink><span v-else>{{participation.title}}</span></h3><dl class="directory-details"><dt>Date de l’événement</dt><dd>{{directoryDate(participation.start)}}</dd><dt>Lieu</dt><dd>{{participation.location||'Non renseigné'}}</dd><dt>Inscription confirmée le</dt><dd>{{directoryDate(participation.confirmedAt)}}</dd><dt>Inscrit par</dt><dd><NuxtLink v-if="participation.registeredByMember" :to="'/membres/'+participation.registeredByMember.id" class="text-link">{{participation.registeredByMember.firstName}} {{participation.registeredByMember.lastName}}</NuxtLink><span v-else>Compte supprimé</span></dd></dl></li></ul></section>
    </template>
  </div>
</template>
