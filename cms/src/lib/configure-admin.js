// One-time editorial form defaults. Subsequent changes in "Configure the view" stay intact.
module.exports=async function configureAdmin(strapi) {
  const store=strapi.store({type:'core',name:'vertical-admin',key:'forms-v6'});
  if(await store.get()) return;
  const forms={
    'api::club-timetable.club-timetable':{main:'season',fields:{season:['Saison','Ex. 2026–2027'],note:['Informations complémentaires'],sessions:['Créneaux de cours','Ajouter un bloc par cours, dans l’ordre d’affichage souhaité.'],ufraps:['Ouvertures et fermetures UFRAPS'],attachments:['Plannings et documents joints','Sélectionner ou téléverser des fichiers dans la médiathèque.']}},
    'api::club-document.club-document':{main:'title',fields:{title:['Titre du document'],slug:['Adresse du document','Conserver cette adresse lors du remplacement du fichier pour préserver les liens.'],category:['Rubrique'],description:['Présentation'],file:['Fichier','Sélectionner ou téléverser le document depuis la médiathèque.']}},
    'api::album.album':{main:'title',fields:{title:['Titre de l’album'],slug:['Adresse de l’album'],description:['Présentation'],coverImage:['Photo de couverture','À défaut, la première photo de l’album sera utilisée.'],images:['Photos de l’album','Ajouter des images depuis la médiathèque. Leur ordre est conservé sur le site.']}},
    'schedules.training-slot':{main:'label',fields:{label:['Nom du créneau','Repère dans l’administration, ex. Adolescents du mardi.'],day:['Jour de la semaine'],start:['Heure de début'],end:['Heure de fin'],audience:['Public / nom du cours'],birthYears:['Années de naissance','Texte libre, ex. 2012 à 2015.'],capacity:['Nombre de places','Laisser vide si non précisé.'],supervised:['Séance encadrée']}},
    'schedules.ufraps':{fields:{opens:['Début de saison'],closes:['Fin de saison','Dernier jour de la saison inclus.'],day:['Jour habituel d’ouverture'],start:['Heure de début'],end:['Heure de fin'],closures:['Périodes de fermeture','Du premier au dernier jour fermé, dates incluses.'],closedDays:['Jours de fermeture exceptionnels','Jours fériés et autres fermetures ponctuelles.']}},
    'schedules.closure':{main:'label',fields:{label:['Nom de la période','Ex. Vacances de Noël.'],from:['Premier jour fermé'],until:['Dernier jour fermé','La reprise est possible à partir du lendemain.']}},
    'schedules.closed-day':{main:'label',fields:{label:['Motif','Ex. Jour férié ou pont de l’Ascension.'],date:['Jour fermé']}},
  };
  forms['api::publication.publication']={main:'title',fields:{title:['Titre'],body:['Texte','Une information, un compte rendu ou une annonce : tout se publie ici.'],photos:['Photos (facultatif)','Ajouter et ordonner les photos. La première sert de couverture par défaut.'],attachments:['Documents joints (facultatif)'],meeting:['Rendez-vous dans l’agenda (facultatif)','Ajouter ce bloc pour afficher cette publication dans l’agenda. Le retirer pour la laisser uniquement dans le fil.'],category:['Thème (facultatif)'],coverImage:['Autre photo de couverture (facultatif)','Laisser vide pour utiliser la première photo.']}};
  forms['publications.meeting']={fields:{start:['Début du rendez-vous'],end:['Fin (facultatif)','Pour une journée entière, indiquer le dernier jour inclus.'],allDay:['Toute la journée'],location:['Lieu'],participationUrl:['Lien pour participer (facultatif)'],participationLabel:['Texte du lien','Ex. S’inscrire ou Répondre au sondage.'],deadline:['Clôture des participations (facultatif)'],eventState:['État du rendez-vous']}};
  for(const uid of ['api::activity.activity','api::article.article','api::event.event']) {
    forms[uid]={fields:{coverImage:['Photo de couverture','Sélectionner ou téléverser une image dans la médiathèque.'],attachments:['Photos et documents joints','Affichés après le texte, sauf les médias déjà intégrés dans le contenu.']}};
  }
  forms['api::page.page']={fields:{documents:['Documents à afficher','Sélectionner les fiches Document du club publiées. Pour Le club, modifier la page presentation.'],attachments:['Fichiers associés','Ces fichiers autorisent les images et liens /media/ utilisés dans le contenu de la page.']}};
  for(const [uid,form] of Object.entries(forms)) {
    const component=!uid.startsWith('api::');
    const service=strapi.plugin('content-manager').service(component?'components':'content-types');
    const model=component?strapi.components[uid]:strapi.contentTypes[uid];
    const config=await service.findConfiguration(model);
    for(const [name,[label,description]] of Object.entries(form.fields)) {
      config.metadatas[name].edit={...config.metadatas[name].edit,label,...(description?{description}:{})};
    }
    if(form.main) config.settings.mainField=form.main;
    const hidden=['sourceId','oldPath','sourceUrl','legacyPath'];
    if(uid==='api::publication.publication')hidden.push('slug','date','legacyKey','legacyType','legacySlug','legacyBody','legacyHtml','legacySummary');
    if(uid==='publications.meeting')hidden.push('calendarUid','tags');
    if(uid==='api::album.album')hidden.push('parentId','cover','photos');
    if(uid==='api::page.page')hidden.push('structuredData');
    if(uid==='api::club-document.club-document')hidden.push('pages');
    if(['api::activity.activity','api::article.article','api::event.event'].includes(uid))hidden.push('image');
    for(const field of hidden)if(config.metadatas[field])config.metadatas[field].edit.visible=false;
    config.layouts.edit=config.layouts.edit.map(row=>row.filter(field=>!hidden.includes(field.name))).filter(row=>row.length);
    if(uid==='api::publication.publication') {
      config.layouts.edit=[['title'],['body'],['photos'],['attachments'],['meeting'],['category','coverImage']].map(row=>row.map(name=>({name,size:row.length===1?12:6})));
      config.layouts.list=['title','date','category'];
    }
    await service.updateConfiguration(model,config);
  }
  await store.set({value:true});
};
