const {errors}=require('@strapi/utils');

function validateTimetable(data) {
  const fail=message=>{throw new errors.ValidationError(message);};
  const seconds=value=>{const [hours,minutes,secs=0]=value.split(':').map(Number);return hours*3600+minutes*60+secs;};
  const times=(item,label)=>{
    if(item.start&&item.end&&seconds(item.end)<=seconds(item.start))fail(`${label} : l’heure de fin doit suivre l’heure de début.`);
  };
  const codes=new Set();
  for(const slot of data.sessions||[]) {
    times(slot,slot.label||'Créneau');
    if(slot.registrationCode){
      if(!/^[a-zA-Z0-9_-]{1,100}$/.test(slot.registrationCode))fail('L’identifiant d’inscription doit contenir uniquement des lettres, chiffres, tirets ou traits de soulignement.');
      if(codes.has(slot.registrationCode))fail('Chaque cours doit avoir un identifiant d’inscription distinct.');
      codes.add(slot.registrationCode);
    }
    if(slot.registrationEnabled) {
      if(!slot.registrationCode)fail('Renseignez un identifiant permanent avant d’ouvrir les inscriptions à ce cours.');
      if(!Number.isSafeInteger(slot.capacity)||slot.capacity<1)fail('Renseignez la capacité avant d’ouvrir les inscriptions à ce cours.');
      if(!Number.isSafeInteger(slot.priceCents)||slot.priceCents<1)fail('Renseignez le tarif standard en centimes avant d’ouvrir les inscriptions à ce cours.');
    }
    if((slot.occupiedPlaces||0)>(slot.capacity??Infinity))fail('Le nombre de places déjà occupées dépasse la capacité du cours.');
  }
  const calendar=data.ufraps;if(!calendar)return;
  times(calendar,'UFRAPS');
  if(calendar.opens&&calendar.closes&&calendar.closes<calendar.opens)fail('UFRAPS : la fin de saison doit suivre son ouverture.');
  for(const closure of calendar.closures||[]) {
    if(closure.from&&closure.until&&closure.until<closure.from)fail(`${closure.label||'Fermeture'} : la fin doit suivre le début.`);
  }
}

function mergeTimetable(previous={},data={}) {
  const rows=(before,after)=>after?.map(row=>({...before?.find(old=>row.id&&row.id===old.id),...row}))??before;
  return {...previous,...data,sessions:rows(previous.sessions,data.sessions),ufraps:data.ufraps?{...previous.ufraps,...data.ufraps,closures:rows(previous.ufraps?.closures,data.ufraps.closures)}:previous.ufraps};
}
module.exports={validateTimetable,mergeTimetable};
