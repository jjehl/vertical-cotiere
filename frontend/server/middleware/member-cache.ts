export default defineEventHandler(event=>{
  if(/^\/(?:compte|mes-publications|connexion|creer-un-compte|mot-de-passe-oublie|reinitialiser-mot-de-passe)(?:\/|$)/.test(getRequestURL(event).pathname)){setHeader(event,'Cache-Control','private, no-store');setHeader(event,'Vary','Cookie');setHeader(event,'Referrer-Policy','no-referrer');}
});
