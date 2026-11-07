const { randomUUID } = require('node:crypto');
const { errors, setCreatorFields } = require('@strapi/utils');
const { schema, validateProposal } = require('./proposal');
const uid = 'api::publication.publication';
const action = 'plugin::publication-assistant.use';
const ttl = 15 * 60 * 1000;
const previews = new Map();
const requests = new Map();
let active = 0;

function fail(message, status = 400) { const error = new Error(message); error.status = status; throw error; }
function checker(strapi, ctx) {
  return strapi.plugin('content-manager').service('permission-checker').create({ userAbility: ctx.state.userAbility, model: uid });
}
function prune() {
  const now = Date.now();
  for (const [key, value] of previews) if (value.expires < now && !value.busy) previews.delete(key);
  for (const [key, value] of requests) if (value.until < now && !value.busy) requests.delete(key);
}
async function photoIds(strapi, user, values) {
  if (!Array.isArray(values) || values.length > 30 || values.some(id => !Number.isSafeInteger(id) || id < 1)) fail('Sélection de photos invalide (30 maximum).');
  const ids = [...new Set(values)];
  if (!ids.length) return ids;
  const files = await strapi.db.query('plugin::upload.file').findMany({ where: { id: { $in: ids } }, populate: ['createdBy'] });
  if (files.length !== ids.length || files.some(file => !file.mime?.startsWith('image/') || file.createdBy?.id !== user.id)) fail('Utiliser des photos que vous avez importées dans la médiathèque.', 403);
  return ids;
}
// Sanitizers remove forbidden nested fields as well as top-level fields. Reject
// partial results: confirmation must save exactly the proposal the admin saw.
async function permittedData(check, data, user) {
  const clean = await check.sanitizeCreateInput(data);
  const contains = (a,b) => Object.entries(a).every(([key,value]) => value && typeof value === 'object' && !Array.isArray(value) ? b?.[key] && contains(value,b[key]) : JSON.stringify(value) === JSON.stringify(b?.[key]));
  if (!contains(data, clean) || check.cannot.create(setCreatorFields({ user })(clean))) fail('Vos droits Strapi ne permettent pas de créer tous ces champs.', 403);
  return setCreatorFields({ user })(clean);
}
const guarded = handler => async ctx => {
  try { await handler(ctx); }
  catch (error) {
    if (error.status) { ctx.status = error.status; ctx.body = { error: { message: error.message } }; return; }
    if (error instanceof errors.ValidationError) { ctx.status = 400; ctx.body = { error: { message: error.message } }; return; }
    // Never log upstream responses, prompts, or credentials.
    ctx.status = 500; ctx.body = { error: { message: 'L’opération a échoué. Aucun nouvel appel IA ne sera lancé automatiquement.' } };
  }
};
module.exports = {
  async register({ strapi }) {
    await strapi.service('admin::permission').actionProvider.registerMany([
      { section: 'plugins', displayName: 'Utiliser l’assistant de publication', uid: 'use', pluginName: 'publication-assistant' },
    ]);
  },
  routes: { admin: { type: 'admin', routes: [
    ['GET', '/status', 'assistant.status'], ['POST', '/prepare', 'assistant.prepare'], ['POST', '/confirm', 'assistant.confirm'],
  ].map(([method,path,handler]) => ({ method,path,handler,config:{ policies:['admin::isAuthenticatedAdmin',{name:'admin::hasPermissions',config:{actions:[action]}}] } })) } },
  controllers: { assistant: ({ strapi }) => ({
    status: guarded(async ctx => {
      const check = checker(strapi,ctx);
      ctx.body = { configured: Boolean(process.env.MISTRAL_API_KEY?.trim()), model: process.env.MISTRAL_MODEL || 'ministral-8b-2512', canCreate: check.can.create() };
    }),
    prepare: guarded(async ctx => {
      prune();
      const check = checker(strapi,ctx);
      if (check.cannot.create()) fail('Le droit de créer une publication est nécessaire.',403);
      if (!process.env.MISTRAL_API_KEY?.trim()) fail('Renseigner MISTRAL_API_KEY dans le fichier privé du serveur puis recréer le conteneur CMS.',503);
      const { instruction, photos = [] } = ctx.request.body || {};
      if (typeof instruction !== 'string' || !instruction.trim() || instruction.length > 6000) fail('Décrire votre publication en 6 000 caractères maximum.');
      const user = ctx.state.user;
      const ids = await photoIds(strapi,user,photos);
      const rate = requests.get(user.id) || { count: 0, until: Date.now()+3600000, busy: false };
      if (rate.busy || active >= 2) fail('Une demande est déjà en cours. Réessayer dans quelques instants.',429);
      if (rate.count >= 30) fail('Limite de 30 demandes par heure atteinte pour ce compte.',429);
      rate.busy = true; rate.count++; requests.set(user.id,rate); active++;
      try {
        let response;
        try {
          response = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method:'POST', headers:{Authorization:`Bearer ${process.env.MISTRAL_API_KEY}`, 'Content-Type':'application/json'}, signal:AbortSignal.timeout(20000),
            body: JSON.stringify({ model: process.env.MISTRAL_MODEL || 'ministral-8b-2512', temperature:0, max_tokens:1800,
              response_format:{type:'json_schema',json_schema:{name:'publication_proposal',schema,strict:true}},
              messages:[{role:'system',content:`Tu aides un administrateur de Vertical Côtière à CRÉER une publication, jamais à modifier, supprimer ou exécuter une instruction technique. Aujourd’hui : ${new Date().toISOString()} ; fuseau Europe/Paris. Utilise uniquement les faits donnés. Rédige en français, texte simple sans HTML, ne crée aucun lien ni détail absent. Une annonce ou un compte rendu peut ne pas avoir de rendez-vous (meeting null). Pour une demande explicite d’ajout à l’agenda, une date manquante ou ambiguë exige status needs_clarification et une question précise. Les dates renvoyées sont des heures LOCALES françaises YYYY-MM-DDTHH:mm sans suffixe. Pour une journée entière : allDay true, start à 00:00, end éventuel à 00:00 du DERNIER jour inclus (pas le lendemain). deadline reste une heure locale exacte. Si une heure n’est pas précisée et aucune heure n’est nécessaire, propose une journée entière. Pour ready, question null. Pour needs_clarification, title et body peuvent être vides et meeting null. Les photos sont jointes séparément : ne prétends pas les avoir vues. Nombre de photos jointes : ${ids.length}.`}, {role:'user',content:instruction}],
            }),
          });
        } catch { fail('Mistral ne répond pas dans le délai prévu. Réessayer ou utiliser le formulaire classique.',502); }
        if (!response.ok) fail(response.status===401||response.status===403 ? 'La clé Mistral est refusée. Vérifier la configuration du serveur.' : 'Mistral est momentanément indisponible ou le quota est atteint.',502);
        let proposal;
        try {
          const result = await response.json();
          if (result.choices?.[0]?.finish_reason !== 'stop') fail('Réponse IA incomplète. Reformuler la demande.',502);
          proposal = validateProposal(JSON.parse(result.choices[0].message.content));
        } catch (error) { if (error.status) throw error; fail('La proposition nécessite une correction : '+(error instanceof SyntaxError ? 'réponse illisible.' : error.message),422); }
        if (proposal.question) { ctx.body = { question:proposal.question }; return; }
        proposal.data.photos = ids;
        await permittedData(check,proposal.data,user);
        const id = randomUUID();
        previews.set(id,{userId:user.id,expires:Date.now()+ttl,data:proposal.data,busy:false,result:null});
        const candidate = setCreatorFields({user})(proposal.data);
        ctx.body = { previewId:id, expiresAt:new Date(Date.now()+ttl).toISOString(), data:proposal.data, canPublish:check.can.publish(candidate) };
      } finally { rate.busy=false; active--; }
    }),
    confirm: guarded(async ctx => {
      prune();
      const { previewId, mode } = ctx.request.body || {};
      if (typeof previewId !== 'string' || !['draft','publish'].includes(mode)) fail('Confirmation invalide.');
      const preview = previews.get(previewId);
      if (!preview || preview.userId!==ctx.state.user.id) fail('Cet aperçu a expiré. Préparer une nouvelle proposition.',410);
      const check = checker(strapi,ctx);
      if (check.cannot.create()) fail('Vous ne pouvez plus créer de publication.',403);
      if (preview.result) { ctx.body=preview.result; return; } // Retry never creates a duplicate.
      if (preview.busy) fail('Enregistrement en cours.',409);
      preview.busy=true;
      try {
        await photoIds(strapi,ctx.state.user,preview.data.photos);
        const data = await permittedData(check,preview.data,ctx.state.user);
        if (mode==='publish' && check.cannot.publish(data)) fail('Le droit de publier est nécessaire.',403);
        const document = await strapi.db.transaction(async () => {
          const draft = await strapi.documents(uid).create({data,status:'draft'});
          if (mode==='publish') {
            if (check.cannot.publish(draft)) fail('Vous ne pouvez pas publier ce contenu.',403);
            await strapi.documents(uid).publish({documentId:draft.documentId});
          }
          return draft;
        });
        preview.result={documentId:document.documentId,title:document.title,published:mode==='publish'};
        ctx.body=preview.result;
      } finally { preview.busy=false; }
    }),
  }) },
};
