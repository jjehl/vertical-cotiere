// Credentials and bearer tokens stay on the CMS server.
let cached;
let refreshing;
function configuration() {
  const base=process.env.HELLOASSO_SANDBOX==='false'?'https://api.helloasso.com':'https://api.helloasso-sandbox.com';
  const site=(process.env.PUBLIC_SITE_URL||'').replace(/\/$/,'');
  return {base,site,slug:process.env.HELLOASSO_ORGANIZATION_SLUG||'vertical-cotiere',clientId:process.env.HELLOASSO_CLIENT_ID,clientSecret:process.env.HELLOASSO_CLIENT_SECRET};
}
function ready() {
  const c=configuration();
  return !!(c.clientId&&c.clientSecret&&/^https:\/\//.test(c.site));
}
async function responseJson(response) {
  if(!response.ok){const error=new Error('Le service de paiement est momentanément indisponible.');error.status=response.status;throw error;}
  return response.json();
}
async function accessToken() {
  const c=configuration();
  if(cached&&cached.until>Date.now()+60000)return cached.token;
  if(!refreshing)refreshing=(async()=>{
    const body=new URLSearchParams(cached?.refreshToken?{grant_type:'refresh_token',refresh_token:cached.refreshToken}:{grant_type:'client_credentials',client_id:c.clientId,client_secret:c.clientSecret});
    const data=await responseJson(await fetch(c.base+'/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,signal:AbortSignal.timeout(15000)}));
    if(!data.access_token)throw new Error('Réponse de paiement invalide.');
    cached={token:data.access_token,refreshToken:data.refresh_token,until:Date.now()+Number(data.expires_in||1800)*1000};
    return cached.token;
  })().finally(()=>{refreshing=null;});
  return refreshing;
}
async function request(path,body) {
  const c=configuration();
  const token=await accessToken();
  return responseJson(await fetch(c.base+'/v5/organizations/'+encodeURIComponent(c.slug)+'/checkout-intents'+path,{
    method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000),
  }));
}
function allowedRedirect(value) {
  try {const url=new URL(value);return url.protocol==='https:'&&['www.helloasso.com','www.helloasso-sandbox.com'].includes(url.hostname);}catch{return false;}
}
async function create(registration) {
  const {site}=configuration();
  const result=await request('',{
    totalAmount:registration.amountCents,initialAmount:registration.amountCents,
    itemName:('Adhésion '+registration.season+' · '+registration.slotLabel).slice(0,250),containsDonation:false,
    backUrl:site+'/inscriptions?paiement=retour',errorUrl:site+'/inscriptions?paiement=erreur',returnUrl:site+'/inscriptions?paiement=verification',
    payer:{firstName:registration.payerFirstName,lastName:registration.payerLastName,email:registration.payerEmail},
    metadata:{registrationReference:registration.reference},
  });
  if(!Number.isSafeInteger(result.id)||!allowedRedirect(result.redirectUrl))throw new Error('Réponse de paiement invalide.');
  return result;
}
module.exports={ready,create,get:id=>request('/'+encodeURIComponent(id)),allowedRedirect};
