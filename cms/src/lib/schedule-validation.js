const {errors}=require('@strapi/utils');

function validateTimetable(data) {
  const fail=message=>{throw new errors.ValidationError(message);};
  const seconds=value=>{const [hours,minutes,secs=0]=value.split(':').map(Number);return hours*3600+minutes*60+secs;};
  const times=(item,label)=>{
    if(item.start&&item.end&&seconds(item.end)<=seconds(item.start))fail(`${label} : l’heure de fin doit suivre l’heure de début.`);
  };
  for(const slot of data.sessions||[])times(slot,slot.label||'Créneau');
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
