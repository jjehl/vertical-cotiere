<script setup lang="ts">
interface ImportReport {
  processed:number
  skipped:number
  created:number
  updated:number
  links:number
  warnings:{sheet:string;line:number;message:string}[]
}
const emit=defineEmits<{imported:[]}>();
const {api}=useMember();
const interactive=useInteractive();
const file=ref<File|null>(null);
const pending=ref(false);
const message=ref('');
const report=ref<ImportReport|null>(null);
const format=ref<'xlsx'|'ods'>('xlsx');
const downloading=ref(false);
const busy=computed(()=>pending.value||downloading.value);
const warnings=computed(()=>{
  const groups=new Map<string,number[]>();
  for(const warning of report.value?.warnings||[]){
    const label=warning.sheet+' — '+warning.message;
    if(!groups.has(label))groups.set(label,[]);
    groups.get(label)!.push(warning.line);
  }
  return [...groups];
});
function chooseFile(event:Event){
  file.value=(event.target as HTMLInputElement).files?.[0]||null;
  report.value=null;
  message.value='';
}
async function importFile(){
  if(!file.value||busy.value)return;
  report.value=null;
  message.value='';
  if(!/\.(xlsx|ods)$/i.test(file.value.name)||file.value.size>8*1024*1024){
    message.value='Choisissez un classeur Excel (.xlsx) ou ODS de 8 Mo maximum.';return;
  }
  pending.value=true;
  try{
    const body=new FormData();
    body.append('file',file.value);
    report.value=await api<ImportReport>('/api/member/directory/import',{method:'POST',body});
    emit('imported');
  }catch(error){message.value=memberError(error);}
  finally{pending.value=false;}
}
async function exportFile(){
  if(busy.value)return;
  message.value='';
  downloading.value=true;
  try{
    const response=await fetch('/api/member/directory/export/'+format.value);
    if(!response.ok){
      const data=await response.json().catch(()=>null);
      throw new Error(data?.error?.message||data?.statusMessage||'L’export du classeur a échoué.');
    }
    const url=URL.createObjectURL(await response.blob());
    const link=document.createElement('a');
    link.href=url;link.download='membres-vertical-cotiere.'+format.value;
    link.click();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
  }catch(error){message.value=error instanceof Error?error.message:'Le téléchargement a échoué.';}
  finally{downloading.value=false;}
}
</script>
<template>
  <details class="member-panel directory-transfer">
    <summary>Importer ou exporter les membres</summary>
    <form class="member-form" @submit.prevent="importFile">
      <label>Classeur à importer (.xlsx ou .ods, 8 Mo maximum)
        <input type="file" accept=".xlsx,.ods" :disabled="!interactive||busy" @change="chooseFile">
      </label>
      <p>Utilisez l’onglet Import_HA. Le nom, le prénom et la date de naissance servent à retrouver les adhérents.</p>
      <MemberActionButton icon="upload" type="submit" :disabled="!file||!interactive||busy">{{pending?'Import en cours…':'Importer le classeur'}}</MemberActionButton>
    </form>
    <form class="member-form" @submit.prevent="exportFile">
      <label>Format d’export<select v-model="format" :disabled="!interactive||busy"><option value="xlsx">Excel (.xlsx)</option><option value="ods">OpenDocument (.ods)</option></select></label>
      <MemberActionButton icon="download" type="submit" :disabled="!interactive||busy">{{downloading?'Export en cours…':'Exporter tous les membres'}}</MemberActionButton>
    </form>
    <p v-if="message" class="member-error" role="alert">{{message}}</p>
    <div v-if="report" role="status">
      <strong>Import terminé</strong>
      <dl class="directory-details">
        <dt>Lignes traitées</dt><dd>{{report.processed}}</dd>
        <dt>Lignes écartées</dt><dd>{{report.skipped}}</dd>
        <dt>Fiches créées</dt><dd>{{report.created}}</dd>
        <dt>Fiches mises à jour</dt><dd>{{report.updated}}</dd>
        <dt>Liens familiaux ajoutés</dt><dd>{{report.links}}</dd>
      </dl>
      <details v-if="warnings.length"><summary>Points à vérifier ({{report.warnings.length}})</summary>
        <ul><li v-for="[label,lines] in warnings" :key="label">{{label}} Lignes {{lines.join(', ')}}.</li></ul>
      </details>
    </div>
  </details>
</template>
<style scoped>
.directory-transfer{margin-bottom:1.5rem}
summary{cursor:pointer;font-weight:600}
form{margin:1.25rem 0;align-items:start}
form p{margin:0}
</style>
