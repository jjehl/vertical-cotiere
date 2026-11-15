<script setup lang="ts">
import type {RegistrationCatalog, RegistrationSlot, RegistrationStatus, RegistrationTariff} from '#shared/registration'
import {registrationTariffs} from '#shared/registration'
import type {TrainingSlot} from '#shared/types'
import {trainingDays} from '#shared/training-week'
useSeoMeta({title:'Inscriptions 2026–2027 — Vertical Côtière',description:'Choisissez votre cours d’escalade, consultez les places disponibles et inscrivez-vous auprès de Vertical Côtière. Paiement sécurisé par HelloAsso.'})
if(import.meta.server){useResponseHeader('Cache-Control').value='private, no-store';useResponseHeader('Vary').value='Cookie'}
const {profile,refresh:refreshMember}=useMember()
const interactive=useInteractive()
try{await refreshMember()}catch{}
const participantMode=ref<'self'|'other'>('self')
const {data:catalog,error,pending,refresh}=await useFetch<RegistrationCatalog>('/api/registrations')
const slotCode=ref('')
const tariff=ref<RegistrationTariff>('STANDARD')
const selected=computed(()=>catalog.value?.sessions.find(slot=>slot.code===slotCode.value))
const amount=computed(()=>selected.value?.prices[tariff.value]??null)
const family=computed(()=>['FAM','CCMP3'].includes(tariff.value))
const form=reactive({firstName:'',lastName:'',birthDate:'',email:'',address:'',familyReference:'',accepted:false})
const today=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Paris'})
const busy=ref(false)
const checking=ref(false)
const message=ref('')
const statusError=ref('')
const registrations=ref<RegistrationStatus[]>([])
const route=useRoute()
const paymentReturn=computed(()=>typeof route.query.paiement==='string')
const canPay=computed(()=>interactive.value&&profile.value?.emailConfirmed&&catalog.value?.open&&catalog.value.paymentReady&&selected.value?.registrationEnabled&&(selected.value.remaining??0)>0&&amount.value!==null)
const money=(cents:number)=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(cents/100)
const slotLabel=(slot:RegistrationSlot)=>`${trainingDays[slot.day-1]} ${slot.start}–${slot.end} · ${slot.audience}`
watch([()=>profile.value?.id,participantMode],()=>{
  const member=profile.value
  form.firstName=participantMode.value==='self'?member?.firstName||'':''
  form.lastName=participantMode.value==='self'?member?.lastName||'':''
  form.email=participantMode.value==='self'?member?.email||'':''
  form.birthDate=''
  form.address=[member?.street,[member?.postalCode,member?.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')
},{immediate:true})
async function anotherParticipant(){
  participantMode.value='other'
  form.firstName='';form.lastName='';form.email='';form.birthDate='';form.accepted=false;message.value=''
  await nextTick()
  document.getElementById('inscription-form')?.scrollIntoView({behavior:'smooth',block:'start'})
}
async function chooseSlot(slot:TrainingSlot){
  slotCode.value=slot.code||''
  await nextTick()
  document.getElementById('inscription-form')?.scrollIntoView({behavior:'smooth',block:'start'})
  document.getElementById('course-choice')?.focus({preventScroll:true})
}
async function checkStatus(){
  if(!profile.value?.emailConfirmed){registrations.value=[];return}
  checking.value=true;statusError.value=''
  try{const data=await $fetch<{registrations:RegistrationStatus[]}>('/api/registrations/status',{method:'POST'});registrations.value=data.registrations;await refresh()}
  catch{statusError.value='Le suivi est momentanément indisponible. Vérifiez à nouveau avant de recommencer un paiement.'}
  finally{checking.value=false}
}
async function pay(){
  if(busy.value||!canPay.value)return
  busy.value=true;message.value=''
  try{
    const result=await $fetch<RegistrationStatus>('/api/registrations/checkout',{method:'POST',body:{...form,participantMode:participantMode.value,slotCode:slotCode.value,promoCode:tariff.value}})
    if(result.checkoutUrl){await navigateTo(result.checkoutUrl,{external:true});return}
    await checkStatus()
    message.value=result.status==='confirmed'?'Cet adhérent est déjà inscrit. Retrouvez la confirmation ci-dessus.':'Un dossier est déjà en attente. Consultez son suivi ci-dessus avant de recommencer.'
  }catch(error:unknown){const failure=error as {data?:{data?:{message?:string}}};message.value=failure.data?.data?.message||'Le paiement n’a pas pu être lancé. Vérifiez le suivi de votre dossier ou contactez le secrétariat.';await checkStatus()}
  finally{busy.value=false}
}
onMounted(async()=>{try{await refreshMember()}catch{}await checkStatus()})
</script>

<template>
  <div class="section listing-page registration-page">
    <span class="eyebrow">Saison {{ catalog?.season || '2026–2027' }}</span>
    <h1>À vous<br /><em>de grimper.</em></h1>
    <p class="page-intro">Choisissez votre cours et inscrivez-vous ici.<br />Le paiement sécurisé est assuré par HelloAsso.</p>
    <ol class="registration-steps" aria-label="Étapes de l’inscription">
      <li><span>01</span> Choisir un créneau</li><li><span>02</span> Compléter son dossier</li><li><span>03</span> Payer avec HelloAsso</li>
    </ol>
    <p class="registration-opening">Nouveaux adhérents : ouverture à partir du <strong>28 mai 2026</strong>. Prenez le temps de lire les <a href="#modalites">modalités</a> et de vérifier votre choix avant de payer : corriger une erreur peut retarder votre inscription.</p>

    <section v-if="registrations.length || paymentReturn || statusError" class="registration-tracking" aria-labelledby="tracking-title" aria-live="polite">
      <h2 id="tracking-title">Le suivi de votre inscription.</h2>
      <p v-if="paymentReturn">Votre retour de HelloAsso ne confirme pas à lui seul le paiement. Le statut ci-dessous est vérifié auprès du service de paiement.</p>
      <p v-if="statusError" role="alert">{{ statusError }}</p>
      <p v-if="!profile?.emailConfirmed">Connectez-vous avec votre adresse e-mail validée pour retrouver vos inscriptions.</p>
      <p v-else-if="!registrations.length && !statusError">{{ checking ? 'Vérification du paiement…' : 'Aucun dossier retrouvé pour votre compte. Si vous avez payé, contactez le secrétariat avant de recommencer.' }}</p>
      <article v-for="registration in registrations" :key="registration.reference" class="registration-record">
        <div><strong>{{ registration.status==='confirmed'?'Inscription confirmée':registration.status==='cancelled'?'Paiement non abouti · place libérée':'Dossier en attente de paiement' }}</strong><p>{{ registration.firstName }} {{ registration.lastName }} · {{ registration.email }}</p><p>{{ registration.slotLabel }} · {{ money(registration.amountCents) }}</p><small>Référence : {{ registration.reference }}</small><p v-if="registration.accountPending || registration.invitationPending">Votre inscription est confirmée ; la création du compte ou l’envoi de son lien d’activation reste en attente. Actualisez le suivi ou contactez le secrétariat.</p><p v-else-if="registration.accountCreated">Un compte membre a été créé. Son lien d’activation a été envoyé à {{ registration.email }}.</p><p v-if="registration.verificationUnavailable">La vérification du paiement est temporairement indisponible.</p><p v-if="['creating','pending'].includes(registration.status) && !registration.checkoutUrl">Votre place reste réservée pendant la vérification. Contactez le secrétariat pour reprendre ou annuler ce dossier.</p></div>
        <a v-if="registration.checkoutUrl" :href="registration.checkoutUrl" class="text-link">Reprendre le paiement ↗</a>
      </article>
      <button v-if="profile?.emailConfirmed && registrations.some(r=>r.status==='confirmed')" type="button" class="text-link registration-another" @click="anotherParticipant">Inscrire une autre personne <ArrowIcon /></button>
      <button v-if="profile?.emailConfirmed" type="button" class="text-link registration-refresh" :disabled="checking" @click="checkStatus">{{ checking?'Vérification…':'Actualiser le suivi' }} <ArrowIcon /></button>
    </section>

    <section id="creneaux" class="timetable-section" aria-labelledby="slots-title">
      <span class="eyebrow">01 · Votre cours</span>
      <h2 id="slots-title">Une place dans la semaine.</h2>
      <p>Choisissez un créneau adapté à l’âge et au niveau de l’adhérent. Les places affichées tiennent compte des inscriptions confirmées et des paiements en attente.</p>
      <ContentState :error="error" @retry="refresh()" />
      <p v-if="pending && !catalog" role="status">Chargement du planning…</p>
      <TrainingWeek v-if="catalog" :sessions="catalog.sessions" :season="catalog.season" registration-mode @select="chooseSlot" />
    </section>

    <section id="inscription-form" class="registration-form-section" aria-labelledby="form-title">
      <div class="registration-form-intro"><span class="eyebrow">02 · Votre inscription</span><h2 id="form-title">On fait connaissance ?</h2><p>Inscrivez-vous ou inscrivez autant de personnes que vous le souhaitez, avec un dossier et un paiement par adhérent. Vous restez le payeur de chaque inscription.</p><p class="fine-print">Une question sur le cours ou le tarif ? <a href="mailto:secretariat@vertical-cotiere.fr">Contactez le secrétariat</a> avant de payer.</p></div>
      <div v-if="!profile?.emailConfirmed" class="registration-access">
        <h3>Un compte validé pour s’inscrire</h3>
        <p>Connectez-vous avec un compte membre dont l’adresse e-mail a été validée. Vous pourrez ensuite vous inscrire et inscrire d’autres adhérents.</p>
        <NuxtLink :to="{path:'/connexion',query:{retour:'/inscriptions'}}" class="button button-orange">Se connecter <ArrowIcon /></NuxtLink>
        <NuxtLink to="/creer-un-compte" class="text-link">Créer un compte <ArrowIcon /></NuxtLink>
        <p class="fine-print">Après la création de votre compte, ouvrez le lien reçu par e-mail pour valider votre adresse.</p>
      </div>
      <form v-else class="registration-form" @submit.prevent="pay">
        <section class="registration-payer" aria-label="Le payeur">
          <strong>Vous êtes le payeur</strong>
          <p>{{ profile.firstName }} {{ profile.lastName }} · {{ profile.email }}</p>
          <NuxtLink to="/compte">Modifier mes coordonnées</NuxtLink>
        </section>
        <fieldset class="registration-person"><legend>Qui souhaitez-vous inscrire ?</legend>
          <label><input v-model="participantMode" type="radio" name="person" value="self" /> Moi-même</label>
          <label><input v-model="participantMode" type="radio" name="person" value="other" /> Une autre personne</label>
        </fieldset>
        <label for="course-choice">Votre créneau</label>
        <select id="course-choice" v-model="slotCode" required><option value="" disabled>Choisir dans le calendrier ou dans cette liste</option><option v-for="slot in catalog?.sessions" :key="slot.code" :value="slot.code" :disabled="slot.remaining===0">{{ slotLabel(slot) }} · {{ slot.remaining==null?'Nous consulter':slot.remaining===0?'Complet':slot.remaining+' places disponibles' }}</option></select>
        <p v-if="selected" class="fine-print">{{ selected.birthYears ? 'Années de naissance : '+selected.birthYears+'. ' : '' }}{{ selected.supervised?'Séance encadrée.':'Pratique autonome, sans encadrement.' }}</p>
        <fieldset class="registration-tariffs"><legend>Votre tarif</legend><label v-for="option in registrationTariffs" :key="option.code" :class="{'is-selected':tariff===option.code}"><input v-model="tariff" type="radio" name="tariff" :value="option.code" /><span><strong>{{ option.label }}</strong><small>{{ option.description }}</small></span><b>{{ selected?.prices[option.code]!=null ? money(selected.prices[option.code]!) : 'À préciser' }}</b></label></fieldset>
        <p class="fine-print">Les réductions sont calculées ici, avant le paiement : CCMP1OU2, FAM ou CCMP3. Le tarif famille concerne chaque adhérent à partir du troisième, de même nom ou même adresse ; les deux premiers restent au tarif standard ou CCMP.</p>
        <label v-if="family">Les deux premiers adhérents de votre famille<input v-model="form.familyReference" required maxlength="500" placeholder="Noms et prénoms, références d’inscription si disponibles" /></label>
        <fieldset><legend>L’adhérent</legend><div class="registration-fields"><label>Prénom<input v-model="form.firstName" :readonly="participantMode==='self'" required minlength="2" maxlength="80" autocomplete="given-name" /></label><label>Nom<input v-model="form.lastName" :readonly="participantMode==='self'" required minlength="2" maxlength="80" autocomplete="family-name" /></label><label>Date de naissance<input v-model="form.birthDate" type="date" required min="1900-01-01" :max="today" /></label></div></fieldset>
        <label>E-mail de l’adhérent<input v-model="form.email" :readonly="participantMode==='self'" required type="email" maxlength="254" autocomplete="email" /></label>
        <p class="fine-print">Après paiement, chaque nouvel adhérent reçoit à cette adresse un lien pour activer son compte et choisir son mot de passe. Une adresse familiale peut être partagée par plusieurs adhérents, chacun avec son propre compte. Un compte existant est conservé.</p>
        <label>Adresse complète de l’adhérent<textarea v-model="form.address" required minlength="5" maxlength="500" rows="2" autocomplete="street-address" placeholder="Rue, code postal et commune" /></label>
        <label class="registration-consent"><input v-model="form.accepted" type="checkbox" required /><span>J’ai lu les <a href="#modalites">modalités de la saison</a> et vérifié le créneau, l’année de naissance et mon éligibilité au tarif choisi.</span></label>
        <div class="registration-total"><span>Adhésion · assurance Base incluse</span><strong>{{ amount==null?'Tarif à préciser':money(amount) }}</strong></div>
        <p v-if="catalog && !catalog.open" class="registration-help" role="status">Les inscriptions en ligne ne sont pas encore ouvertes.</p>
        <p v-else-if="catalog && !catalog.paymentReady" class="registration-help" role="status">Le paiement en ligne sera disponible prochainement. Vous pouvez déjà consulter les cours et préparer votre choix.</p>
        <p v-else-if="selected && !selected.registrationEnabled" class="registration-help">Pour ce créneau, contactez le secrétariat avant de vous inscrire. L’accès au groupe compétition est validé par les entraîneurs fin juin.</p>
        <p v-if="message" role="alert" class="registration-help">{{ message }}</p>
        <button type="submit" class="button button-orange" :disabled="!canPay || busy">{{ busy?'Préparation du paiement…':'Continuer vers le paiement' }} <ArrowIcon /></button>
        <p class="fine-print">Vos informations sont utilisées pour gérer votre adhésion. Les coordonnées du payeur, le cours, le montant et la référence du dossier sont transmis à HelloAsso pour le paiement. <NuxtLink to="/informations">Vos données</NuxtLink>.</p>
      </form>
    </section>

    <section id="modalites" class="timetable-section registration-terms" aria-labelledby="terms-title">
      <span class="eyebrow">À lire avant de payer</span><h2 id="terms-title">Les modalités de la saison.</h2>
      <details open><summary>Inscription et réductions</summary><div><p>L’inscription est réservée aux membres connectés dont l’e-mail est validé. Le membre connecté peut s’inscrire et inscrire d’autres personnes ; il reste le payeur de chaque dossier. Chaque nouvel adhérent dispose de son propre compte, à activer par e-mail après paiement. Seul le paiement passe par HelloAsso Checkout. Lisez les informations du cours et suivez les étapes dans l’ordre. En cas de doute, écrivez au secrétariat avant de payer : les remboursements prennent du temps et une erreur peut compromettre votre place.</p><p>Le tarif standard concerne les habitants hors CCMP. Les résidents de la CCMP choisissent <strong>CCMP1OU2</strong>. À partir du troisième adhérent de la même famille (même nom ou même adresse), faites un dossier distinct et choisissez <strong>CCMP3</strong> si vous habitez la CCMP, ou <strong>FAM</strong> sinon. La réduction ne s’applique pas aux deux premiers adhérents. Les codes sont en majuscules, sans espace ; le choix du tarif les applique automatiquement avant le paiement.</p></div></details>
      <details><summary>Aides, remboursements et documents</summary><div><p>Pour régler une partie de l’adhésion avec un Pass’Sport, Pass Région, chèque collège / chèque01, coupon sport ou Miribel, ou des chèques-vacances, payez d’abord en ligne, puis demandez le remboursement aux trésoriers. Le formulaire sert aussi à corriger une erreur de réduction CCMP ou famille.</p><p>Remplissez <a href="https://framaforms.org/demande-de-remboursement-1786541037" target="_blank" rel="noopener noreferrer">le formulaire de remboursement ↗</a> <strong>une fois par type d’aide ou de remboursement</strong> : par exemple, trois demandes pour un Pass’Sport, un Pass Région et des chèques-vacances. Déposez aussi les justificatifs dans la boîte prévue au gymnase <strong>au plus tard le 30 novembre 2026</strong>. Les remboursements seront effectués <strong>courant décembre</strong>.</p><p><strong>Pas de remboursement en cas de désistement en cours d’année</strong>, en particulier dès que la licence FFME est saisie.</p><p>Pour une attestation ou un document à signer : imprimez-le, préremplissez-le et déposez-le dans la boîte du gymnase. Vous pourrez le récupérer la semaine suivante.</p></div></details>
      <details><summary>Compétition et grimpe du samedi</summary><div><p><strong>Groupe compétition :</strong> l’adhésion est validée par les entraîneurs fin juin.</p><p><strong>Mur STAPS de Villeurbanne :</strong> en complément des cours, grimpez le samedi de <strong>10 h à 12 h</strong> au mur Escoffier du gymnase SIUAPS, 22–29 boulevard du 11 Novembre, Villeurbanne. Consultez les <NuxtLink to="/horaires-et-acces">dates d’ouverture</NuxtLink>.</p><p>Ce créneau <strong>sans encadrement</strong> s’adresse aux adhérents ou familles d’adhérents autonomes. Les mineurs doivent être accompagnés d’un adulte et restent sous sa responsabilité.</p></div></details>
      <details><summary>Chaussons et boutique du club</summary><div><p><strong>Location de chaussons : 35 €</strong>, via <a href="https://www.helloasso.com/associations/vertical-cotiere/adhesions/location-chaussons-escalade-2026-2027" target="_blank" rel="noopener noreferrer">la campagne de location HelloAsso ↗</a>.</p><p>Le club proposera aussi des tee-shirts, vestes et doudounes sans manches dans sa boutique HelloAsso.</p></div></details>
      <details><summary>Licence et assurance FFME</summary><div><p>L’adhésion inclut l’assurance FFME, avec la formule <strong>Base</strong> par défaut, comprise dans le tarif. Consultez <a href="https://www.montagne-escalade.com/site/BO/documents/2022-notice-assurance.pdf" target="_blank" rel="noopener noreferrer">la notice d’assurance mise à disposition ↗</a>.</p><p>Les informations d’assurance sont dématérialisées et envoyées par e-mail pendant l’été. Si vous ne les avez pas reçues à la rentrée, contactez-nous.</p></div></details>
    </section>
    <div class="notice"><h2>Un doute avant de vous lancer ?</h2><p>Pour les inscriptions, les tarifs ou une précision sur votre dossier, le secrétariat vous répondra au plus vite, dans la mesure du possible.</p><a href="mailto:secretariat@vertical-cotiere.fr" class="text-link">secretariat@vertical-cotiere.fr <ArrowIcon /></a></div>
  </div>
</template>

<style scoped>
.registration-access,.registration-payer{padding:22px;background:#e8efe6;border:1px solid var(--line);border-radius:8px}.registration-access h3{margin:0 0 12px}.registration-access p,.registration-payer p{font-size:14px;line-height:1.7}.registration-access .text-link{margin-top:12px}.registration-payer{margin-bottom:24px}.registration-payer a{font-size:12px}.registration-form .registration-person label{display:inline-flex;flex-direction:row;align-items:center;margin-right:20px;gap:8px}.registration-form input:read-only{color:var(--muted);background:#eeeee7!important}.registration-form>label{margin-top:18px}.registration-another{border:0;background:transparent;margin-right:24px;font:inherit;font-size:13px;cursor:pointer}

.registration-steps{display:flex;gap:36px;list-style:none;padding:0;margin:32px 0;font-size:14px;font-weight:600;flex-wrap:wrap}.registration-steps span{color:var(--orange);margin-right:8px}.registration-opening{max-width:780px;font-size:14px;line-height:1.8;color:var(--muted)}.registration-page a:not(.button):not(.text-link){text-decoration:underline;text-underline-offset:3px}.registration-form-section{display:grid;grid-template-columns:.8fr 1.2fr;gap:64px;margin:64px 0;padding:48px 0;border-top:1px solid var(--line);scroll-margin-top:110px}.registration-form-intro h2{font-size:clamp(28px,3vw,42px);letter-spacing:-.04em;margin:16px 0}.registration-form-intro p{line-height:1.8}.registration-form{min-width:0}.registration-form label{display:flex;flex-direction:column;gap:8px;font-size:13px;font-weight:600}.registration-form input:not([type=checkbox]):not([type=radio]),.registration-form select,.registration-form textarea{width:100%;min-width:0;border:1px solid var(--line);border-radius:6px;padding:12px;background:#fcfbf7;color:var(--ink);font:inherit}.registration-form>select{margin-top:8px}.registration-form fieldset{padding:0;border:0;margin:26px 0}.registration-form legend{font-weight:700;font-size:16px;margin-bottom:14px}.registration-fields{display:grid;grid-template-columns:1fr 1fr;gap:18px}.registration-field-wide{grid-column:1/-1}.registration-form .registration-tariffs{display:grid;gap:10px}.registration-tariffs label{flex-direction:row;align-items:center;gap:12px;border:1px solid var(--line);border-radius:8px;padding:14px;cursor:pointer}.registration-tariffs label.is-selected{border-color:var(--green,#233b31);background:#e8efe6}.registration-tariffs span{flex:1}.registration-tariffs small{display:block;font-weight:400;font-size:11px;line-height:1.5;margin-top:4px}.registration-tariffs b{font-size:14px;white-space:nowrap}.registration-form .registration-consent{flex-direction:row;align-items:flex-start;font-weight:400;line-height:1.7}.registration-consent input{margin-top:5px}.registration-total{display:flex;justify-content:space-between;align-items:center;gap:16px;border-top:1px solid var(--line);padding:24px 0;margin-top:24px;font-size:13px}.registration-total strong{font-size:22px;white-space:nowrap}.registration-form .button{width:100%;justify-content:center}.registration-form .button:disabled{opacity:.55;cursor:not-allowed}.registration-help{background:#f6e7d8;padding:16px;border-radius:6px;font-size:13px;line-height:1.7}.registration-page .fine-print{font-size:12px;line-height:1.7;color:var(--muted);margin:14px 0}.registration-terms details>div{padding:6px 0 12px;max-width:900px}.registration-terms p{line-height:1.8;font-size:14px;margin:14px 0}.registration-terms summary{font-weight:600}.registration-tracking{margin-top:32px;padding:28px;background:#e8efe6;border-radius:12px}.registration-tracking h2{font-size:24px;letter-spacing:-.03em}.registration-tracking>p,.registration-record p{font-size:13px;line-height:1.7}.registration-record{padding:20px 0;border-top:1px solid #233b3125;display:flex;gap:24px;justify-content:space-between;align-items:center}.registration-record small{font-size:11px;overflow-wrap:anywhere}.registration-refresh{background:none;border:0;padding:0;font:inherit;cursor:pointer;font-size:13px}#creneaux,#modalites{scroll-margin-top:110px}@media(max-width:760px){.registration-form-section{grid-template-columns:1fr;gap:24px;padding:32px 0;margin:40px 0}.registration-steps{gap:12px;flex-direction:column;margin:24px 0}.registration-fields{grid-template-columns:1fr}.registration-field-wide{grid-column:auto}.registration-total{align-items:flex-start;flex-direction:column;gap:8px}.registration-record{flex-direction:column;align-items:flex-start;gap:10px}.registration-tracking{padding:20px}.registration-tariffs label{padding:12px;gap:8px}}
</style>
