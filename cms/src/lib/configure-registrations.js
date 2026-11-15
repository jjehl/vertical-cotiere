const {slotCode}=require('./course-registrations');
module.exports=async function configureRegistrations(app) {
  // Persist a stable identity independently of component ids, which change on publication.
  const slots=await app.db.query('schedules.training-slot').findMany({});
  for(const slot of slots)if(!slot.registrationCode)await app.db.query('schedules.training-slot').update({where:{id:slot.id},data:{registrationCode:slotCode(slot)}});
  const timetables=await app.db.query('api::club-timetable.club-timetable').findMany({});
  for(const timetable of timetables)if(timetable.note?.includes('Les horaires HelloAsso restent la référence lors de l’inscription.'))await app.db.query('api::club-timetable.club-timetable').update({where:{id:timetable.id},data:{note:timetable.note.replace('Les horaires HelloAsso restent la référence lors de l’inscription.','Les créneaux et les disponibilités se consultent sur la page d’inscription du site.')}});
  const store=app.store({type:'core',name:'vertical-admin',key:'registration-forms-v2'});
  if(await store.get())return;
  const forms={
    'api::club-timetable.club-timetable':{
      registrationsOpen:['Ouvrir les inscriptions','Activer après avoir vérifié les tarifs, capacités et places occupées, puis publier.'],
      registrationOpensAt:['Date d’ouverture des inscriptions','28 mai 2026 par défaut ; les inscriptions doivent aussi être activées.'],
    },
    'schedules.training-slot':{
      registrationCode:['Identifiant d’inscription','Unique et permanent pour ce cours. Ne pas le modifier après une première inscription.'],
      registrationEnabled:['Inscription en ligne à ce cours','Activer après vérification des tarifs et du nombre de places.'],
      occupiedPlaces:['Places déjà occupées hors du site','Inscriptions historiques uniquement. Zéro en local ; les dossiers créés sur le site sont comptés automatiquement.'],
      priceCents:['Tarif standard (centimes)','Exemple : 20000 pour 200 €. Aucun montant n’est prérempli.'],
      ccmpPriceCents:['Tarif CCMP1OU2 (centimes)'],
      familyPriceCents:['Tarif FAM (centimes)'],
      ccmpFamilyPriceCents:['Tarif CCMP3 (centimes)'],
    },
    'api::course-registration.course-registration':{
      reference:['Référence du dossier'],season:['Saison'],slotCode:['Identifiant du cours'],slotLabel:['Cours choisi'],
      firstName:['Prénom de l’adhérent'],lastName:['Nom de l’adhérent'],birthDate:['Date de naissance'],email:['E-mail de l’adhérent'],payer:['Membre payeur'],member:['Compte de l’adhérent'],payerEmail:['E-mail du payeur'],memberCreated:['Compte créé pour cette inscription'],
      payerFirstName:['Prénom du payeur'],payerLastName:['Nom du payeur'],address:['Adresse de l’adhérent'],promoCode:['Tarif appliqué'],familyReference:['Deux premiers adhérents de la famille'],
      amountCents:['Montant (centimes)'],registrationStatus:['État du dossier','creating : lancement incertain ; pending : paiement attendu ; confirmed : confirmé ; cancelled : annulé et place libérée. Vérifier HelloAsso avant toute annulation.'],
      checkoutIntentId:['Identifiant HelloAsso'],checkoutCreatedAt:['Création du paiement'],confirmedAt:['Paiement confirmé le'],
    },
  };
  for(const [uid,fields] of Object.entries(forms)) {
    const component=!uid.startsWith('api::');
    const service=app.plugin('content-manager').service(component?'components':'content-types');
    const model=component?app.components[uid]:app.contentTypes[uid];
    const config=await service.findConfiguration(model);
    for(const [name,[label,description]] of Object.entries(fields))if(config.metadatas[name])config.metadatas[name].edit={...config.metadatas[name].edit,label,...(description?{description}:{})};
    if(uid==='api::course-registration.course-registration') {
      config.settings.mainField='reference';
      config.layouts.list=['firstName','lastName','slotLabel','registrationStatus','amountCents'];
      const hidden=['sessionHash','participantKey','checkoutUrl'];
      for(const key of hidden)if(config.metadatas[key])config.metadatas[key].edit.visible=false;
      config.layouts.edit=config.layouts.edit.map(row=>row.filter(field=>!hidden.includes(field.name))).filter(row=>row.length);
    }
    await service.updateConfiguration(model,config);
  }
  await store.set({value:true});
};
