import React, { useEffect, useRef, useState } from 'react';
import { useFetchClient } from '@strapi/strapi/admin';
import { Link, useSearchParams } from 'react-router-dom';
import './assistant.css';

const base = '/publication-assistant';
const editor = '/content-manager/collection-types/api::publication.publication';
const date = value => new Intl.DateTimeFormat('fr-FR', { timeZone:'Europe/Paris',dateStyle:'full',timeStyle:'short' }).format(new Date(value));
const day = value => new Intl.DateTimeFormat('fr-FR', { timeZone:'UTC',dateStyle:'full' }).format(new Date(value));
const errorMessage = error => error?.response?.data?.error?.message || 'La demande a échoué. Vous pouvez réessayer.';

export default function Assistant() {
  const [params]=useSearchParams();
  const documentId=params.get('documentId');
  return <AssistantForm key={documentId||'create'} documentId={documentId}/>;
}

function MeetingPreview({meeting}) {
  if(!meeting)return <p>Sans rendez-vous dans l’agenda.</p>;
  return <div className="vc-assistant__meeting"><h4>Dans l’agenda</h4><dl>
    <dt>Début</dt><dd>{meeting.allDay?day(meeting.start)+' · journée entière':date(meeting.start)}</dd>
    {meeting.end&&<><dt>Fin</dt><dd>{meeting.allDay?day(meeting.end):date(meeting.end)}</dd></>}
    {meeting.location&&<><dt>Lieu</dt><dd>{meeting.location}</dd></>}
    <dt>État</dt><dd>{meeting.eventState}</dd>
    {meeting.deadline&&<><dt>Clôture des inscriptions</dt><dd>{date(meeting.deadline)}</dd></>}
    {meeting.participationUrl&&<><dt>Participation</dt><dd>{meeting.participationLabel&&<span>{meeting.participationLabel} : </span>}<a href={meeting.participationUrl} target="_blank" rel="noopener noreferrer">{meeting.participationUrl}</a></dd></>}
  </dl></div>;
}

function AssistantForm({documentId}) {
  const editing=Boolean(documentId);
  const client = useFetchClient();
  const [status,setStatus] = useState(null);
  const [original,setOriginal] = useState(null);
  const [instruction,setInstruction] = useState('');
  const [photos,setPhotos] = useState([]);
  const [preview,setPreview] = useState(null);
  const [question,setQuestion] = useState('');
  const [error,setError] = useState('');
  const [busy,setBusy] = useState('');
  const [saved,setSaved] = useState(null);
  const lock = useRef(false);
  useEffect(() => { let live=true; client.get(base+'/status').then(({data})=>{if(live)setStatus(data);}).catch(error=>{if(live)setError(errorMessage(error));}); return()=>{live=false;}; },[]);
  useEffect(()=>{
    if(!editing)return;
    let live=true;
    client.get(base+'/publications/'+encodeURIComponent(documentId)).then(({data})=>{
      if(live){setOriginal(data);setPhotos(data.photos);}
    }).catch(error=>{if(live)setError(errorMessage(error));});
    return()=>{live=false;};
  },[]);
  const invalidate = () => { setPreview(null); setQuestion(''); setSaved(null); setError(''); };
  async function run(label,operation) {
    if(lock.current)return;
    lock.current=true;setBusy(label);setError('');
    try { await operation(); } catch(error) { setError(errorMessage(error)); }
    finally { lock.current=false;setBusy(''); }
  }
  async function upload(event) {
    const files=Array.from(event.target.files || []);event.target.value='';
    if(!files.length)return;
    if(photos.length+files.length>30){setError('Vous pouvez joindre 30 photos maximum.');return;}
    if(files.some(file=>!file.type.startsWith('image/')||file.size>20*1024*1024)){setError('Choisir des images de moins de 20 Mo chacune.');return;}
    invalidate();
    await run('Import des photos…',async()=>{
      const form=new FormData();files.forEach(file=>form.append('files',file));
      const {data}=await client.post('/upload',form);
      setPhotos(current=>[...current,...data.map(file=>({id:file.id,name:file.name,url:file.url}))]);
    });
  }
  async function prepare(event) {
    event.preventDefault();setSaved(null);setPreview(null);setQuestion('');
    await run('Préparation de la proposition…',async()=>{
      const {data}=await client.post(base+'/prepare',{instruction,...(editing?{documentId,version:original.version}:{photos:photos.map(photo=>photo.id)})});
      if(data.question)setQuestion(data.question);else setPreview(data);
    });
  }
  async function confirm(mode) {
    await run('Enregistrement…',async()=>{
      const {data}=await client.post(base+'/confirm',{previewId:preview.previewId,mode});
      setSaved(data);setPreview(null);setInstruction('');
      if(editing) {
        try {
          const current=await client.get(base+'/publications/'+encodeURIComponent(documentId));
          setOriginal(current.data);setPhotos(current.data.photos);
        }catch { setOriginal(null);setError('Modification enregistrée. Rouvrez la fiche pour continuer.'); }
      }else setPhotos([]);
    });
  }
  return <main className="vc-assistant">
    <header><p className="vc-assistant__eyebrow">LA VIE DU CLUB, SIMPLEMENT</p><h1>{editing?'Modifier avec l’assistant IA':'Assistant de publication'}</h1><p>{editing?'Décrivez les changements souhaités. Vérifiez la version actuelle et la proposition avant de confirmer.':'Décrivez une actualité, une sortie ou une compétition. Ajoutez vos photos, puis vérifiez la proposition avant de l’enregistrer.'}</p>{editing&&<p><Link to={editor+'/'+documentId}>Revenir à la publication</Link></p>}</header>
    <div className="vc-assistant__layout">
      <section className="vc-assistant__panel">
        <h2>1. Votre demande</h2>
        {status&&!status.configured&&<p className="vc-assistant__notice">L’assistant est prêt à être configuré. Renseignez <code>MISTRAL_API_KEY</code> dans le fichier privé du serveur puis recréez le conteneur CMS. Le formulaire classique reste disponible.</p>}
        {!editing&&status&&!status.canCreate&&<p role="alert">Votre rôle doit autoriser la création de publications.</p>}
        {editing&&original&&<div className="vc-assistant__notice"><strong>{original.data.title}</strong><p>Le brouillon enregistré sert de point de départ. Les photos, les documents et l’adresse de la page sont conservés. Enregistrez vos changements dans la fiche avant d’ouvrir cet assistant.</p></div>}
        <form onSubmit={prepare}>
          <label htmlFor="vc-instruction">{editing?'Que souhaitez-vous modifier ?':'Que souhaitez-vous partager ?'}</label>
          <textarea id="vc-instruction" rows="9" maxLength="6000" required value={instruction} disabled={!!busy} placeholder={editing?"Décale cette sortie au 23 mai 2027, garde les mêmes horaires et précise qu’il faut apporter un casque.":"Ajoute une sortie falaise le 16 mai 2027 de 9 h à 17 h à Vertrieu. Rendez-vous sur le parking, prévoir un pique-nique. Inscription auprès de Julie."} onChange={event=>{invalidate();setInstruction(event.target.value);}} />
          <p className="vc-assistant__hint">Précisez les dates et le lieu pour un rendez-vous. Pour un compte rendu, racontez simplement la sortie.</p>
          <label htmlFor="vc-photos">{editing?'Photos conservées':'Photos (facultatif)'}</label>
          {!editing&&<input id="vc-photos" type="file" accept="image/*" multiple disabled={!!busy||!!preview} onChange={upload}/>}
          <p className="vc-assistant__hint">Les photos restent dans votre médiathèque Strapi. Seul votre texte est envoyé à Mistral.</p>
          {photos.length>0&&<ul className="vc-assistant__photos">{photos.map(photo=><li key={photo.id}><img src={photo.url} alt=""/><span>{photo.name}</span>{!editing&&<button type="button" disabled={!!busy} aria-label={'Retirer '+photo.name} onClick={()=>{invalidate();setPhotos(photos.filter(item=>item.id!==photo.id));}}>Retirer</button>}</li>)}</ul>}
          <button className="vc-assistant__primary" disabled={!!busy||!status?.configured||(editing?!original:!status?.canCreate)||!instruction.trim()} type="submit">Préparer la proposition</button>
        </form>
        <p className="vc-assistant__hint">Pour gérer les photos ou les documents : <Link to={editor}>ouvrir les publications</Link>.</p>
      </section>
      <section className="vc-assistant__panel" aria-labelledby="vc-preview-heading" aria-busy={!!busy}>
        <h2 id="vc-preview-heading">2. Vérifiez et confirmez</h2>
        {busy&&<p role="status">{busy}</p>}
        {error&&<p className="vc-assistant__error" role="alert">{error}</p>}
        {question&&<div className="vc-assistant__notice"><h3>Une précision est nécessaire</h3><p>{question}</p><p>Complétez votre demande à gauche, puis relancez la préparation.</p></div>}
        {!preview&&!saved&&!question&&!busy&&<p className="vc-assistant__empty">{editing?'La proposition apparaîtra ici. Aucune modification ne sera enregistrée avant votre confirmation.':'Votre proposition apparaîtra ici. Aucune publication ne sera créée avant votre confirmation.'}</p>}
        {preview&&<article className="vc-assistant__preview">
          {preview.original&&<section aria-label="Avant modification" className="vc-assistant__before"><h3>Avant modification</h3><p>{preview.original.category}</p><h4>{preview.original.title}</h4><p className="vc-assistant__body">{preview.original.body}</p><MeetingPreview meeting={preview.original.meeting}/></section>}
          {editing&&<h3>Proposition de modification</h3>}
          <p className="vc-assistant__eyebrow">{preview.data.category}</p>
          <h3>{preview.data.title}</h3><p className="vc-assistant__body">{preview.data.body}</p>
          <MeetingPreview meeting={preview.data.meeting}/>
          <p>{preview.data.photos.length} photo{preview.data.photos.length>1?'s':''} jointe{preview.data.photos.length>1?'s':''}.</p>
          <p className="vc-assistant__hint">Vérifiez les faits, les dates et les heures (France). Pour corriger, précisez votre demande puis préparez une nouvelle proposition. L’aperçu expire après 15 minutes.</p>
          <div className="vc-assistant__actions"><button disabled={!!busy} onClick={()=>confirm('draft')}>Enregistrer le brouillon</button>{preview.canPublish&&<button className="vc-assistant__primary" disabled={!!busy} onClick={()=>confirm('publish')}>Confirmer et publier</button>}</div>
        </article>}
        {saved&&<div role="status" className="vc-assistant__notice"><h3>{saved.updated?(saved.published?'Modification publiée':'Modification enregistrée en brouillon'):(saved.published?'Publication en ligne':'Brouillon enregistré')}</h3><p>{saved.title}</p><Link to={editor+'/'+saved.documentId}>Ouvrir dans Strapi</Link></div>}
      </section>
    </div>
    <footer>Modèle : {status?.model||'…'} · La validation humaine reste nécessaire. En cas d’indisponibilité de l’IA, utilisez le formulaire habituel.</footer>
  </main>;
}
