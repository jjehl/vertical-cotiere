import React, { useEffect, useRef, useState } from 'react';
import { useFetchClient } from '@strapi/strapi/admin';
import { Link } from 'react-router-dom';
import './assistant.css';

const base = '/publication-assistant';
const editor = '/content-manager/collection-types/api::publication.publication';
const date = value => new Intl.DateTimeFormat('fr-FR', { timeZone:'Europe/Paris',dateStyle:'full',timeStyle:'short' }).format(new Date(value));
const day = value => new Intl.DateTimeFormat('fr-FR', { timeZone:'UTC',dateStyle:'full' }).format(new Date(value));
const errorMessage = error => error?.response?.data?.error?.message || 'La demande a échoué. Vous pouvez réessayer.';

export default function Assistant() {
  const client = useFetchClient();
  const [status,setStatus] = useState(null);
  const [instruction,setInstruction] = useState('');
  const [photos,setPhotos] = useState([]);
  const [preview,setPreview] = useState(null);
  const [question,setQuestion] = useState('');
  const [error,setError] = useState('');
  const [busy,setBusy] = useState('');
  const [saved,setSaved] = useState(null);
  const lock = useRef(false);
  useEffect(() => { let live=true; client.get(base+'/status').then(({data})=>{if(live)setStatus(data);}).catch(error=>{if(live)setError(errorMessage(error));}); return()=>{live=false;}; },[]);
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
      const {data}=await client.post(base+'/prepare',{instruction,photos:photos.map(photo=>photo.id)});
      if(data.question)setQuestion(data.question);else setPreview(data);
    });
  }
  async function confirm(mode) {
    await run('Enregistrement…',async()=>{
      const {data}=await client.post(base+'/confirm',{previewId:preview.previewId,mode});
      setSaved(data);setPreview(null);setInstruction('');setPhotos([]);
    });
  }
  return <main className="vc-assistant">
    <header><p className="vc-assistant__eyebrow">LA VIE DU CLUB, SIMPLEMENT</p><h1>Assistant de publication</h1><p>Décrivez une actualité, une sortie ou une compétition. Ajoutez vos photos, puis vérifiez la proposition avant de l’enregistrer.</p></header>
    <div className="vc-assistant__layout">
      <section className="vc-assistant__panel">
        <h2>1. Votre demande</h2>
        {status&&!status.configured&&<p className="vc-assistant__notice">L’assistant est prêt à être configuré. Renseignez <code>MISTRAL_API_KEY</code> dans le fichier privé du serveur puis recréez le conteneur CMS. Le formulaire classique reste disponible.</p>}
        {status&&!status.canCreate&&<p role="alert">Votre rôle doit autoriser la création de publications.</p>}
        <form onSubmit={prepare}>
          <label htmlFor="vc-instruction">Que souhaitez-vous partager ?</label>
          <textarea id="vc-instruction" rows="9" maxLength="6000" required value={instruction} disabled={!!busy} placeholder="Ajoute une sortie falaise le 16 mai 2027 de 9 h à 17 h à Vertrieu. Rendez-vous sur le parking, prévoir un pique-nique. Inscription auprès de Julie." onChange={event=>{invalidate();setInstruction(event.target.value);}} />
          <p className="vc-assistant__hint">Précisez les dates et le lieu pour un rendez-vous. Pour un compte rendu, racontez simplement la sortie.</p>
          <label htmlFor="vc-photos">Photos (facultatif)</label>
          <input id="vc-photos" type="file" accept="image/*" multiple disabled={!!busy||!!preview} onChange={upload}/>
          <p className="vc-assistant__hint">Les photos restent dans votre médiathèque Strapi. Seul votre texte est envoyé à Mistral.</p>
          {photos.length>0&&<ul className="vc-assistant__photos">{photos.map(photo=><li key={photo.id}><img src={photo.url} alt=""/><span>{photo.name}</span><button type="button" disabled={!!busy} aria-label={'Retirer '+photo.name} onClick={()=>{invalidate();setPhotos(photos.filter(item=>item.id!==photo.id));}}>Retirer</button></li>)}</ul>}
          <button className="vc-assistant__primary" disabled={!!busy||!status?.configured||!status?.canCreate||!instruction.trim()} type="submit">Préparer la proposition</button>
        </form>
        <p className="vc-assistant__hint">Pour modifier une publication existante ou ajouter des documents : <Link to={editor}>ouvrir les publications</Link>.</p>
      </section>
      <section className="vc-assistant__panel" aria-labelledby="vc-preview-heading" aria-busy={!!busy}>
        <h2 id="vc-preview-heading">2. Vérifiez et confirmez</h2>
        {busy&&<p role="status">{busy}</p>}
        {error&&<p className="vc-assistant__error" role="alert">{error}</p>}
        {question&&<div className="vc-assistant__notice"><h3>Une précision est nécessaire</h3><p>{question}</p><p>Complétez votre demande à gauche, puis relancez la préparation.</p></div>}
        {!preview&&!saved&&!question&&!busy&&<p className="vc-assistant__empty">Votre proposition apparaîtra ici. Aucune publication ne sera créée avant votre confirmation.</p>}
        {preview&&<article className="vc-assistant__preview">
          <p className="vc-assistant__eyebrow">{preview.data.category}</p>
          <h3>{preview.data.title}</h3><p className="vc-assistant__body">{preview.data.body}</p>
          {preview.data.meeting&&<div className="vc-assistant__meeting"><h4>Dans l’agenda</h4><dl>
            <dt>Début</dt><dd>{preview.data.meeting.allDay?day(preview.data.meeting.start)+' · journée entière':date(preview.data.meeting.start)}</dd>
            {preview.data.meeting.end&&<><dt>Fin</dt><dd>{preview.data.meeting.allDay?day(preview.data.meeting.end):date(preview.data.meeting.end)}</dd></>}
            {preview.data.meeting.location&&<><dt>Lieu</dt><dd>{preview.data.meeting.location}</dd></>}
            <dt>État</dt><dd>{preview.data.meeting.eventState}</dd>
            {preview.data.meeting.deadline&&<><dt>Clôture des inscriptions</dt><dd>{date(preview.data.meeting.deadline)}</dd></>}
            {preview.data.meeting.participationUrl&&<><dt>Participation</dt><dd>{preview.data.meeting.participationLabel&&<span>{preview.data.meeting.participationLabel} : </span>}<a href={preview.data.meeting.participationUrl} target="_blank" rel="noopener noreferrer">{preview.data.meeting.participationUrl}</a></dd></>}
          </dl></div>}
          <p>{preview.data.photos.length} photo{preview.data.photos.length>1?'s':''} jointe{preview.data.photos.length>1?'s':''}.</p>
          <p className="vc-assistant__hint">Vérifiez les faits, les dates et les heures (France). Pour corriger, précisez votre demande puis préparez une nouvelle proposition. L’aperçu expire après 15 minutes.</p>
          <div className="vc-assistant__actions"><button disabled={!!busy} onClick={()=>confirm('draft')}>Enregistrer le brouillon</button>{preview.canPublish&&<button className="vc-assistant__primary" disabled={!!busy} onClick={()=>confirm('publish')}>Confirmer et publier</button>}</div>
        </article>}
        {saved&&<div role="status" className="vc-assistant__notice"><h3>{saved.published?'Publication en ligne':'Brouillon enregistré'}</h3><p>{saved.title}</p><Link to={editor+'/'+saved.documentId}>Ouvrir dans Strapi</Link></div>}
      </section>
    </div>
    <footer>Modèle : {status?.model||'…'} · La validation humaine reste nécessaire. En cas d’indisponibilité de l’IA, utilisez le formulaire habituel.</footer>
  </main>;
}
