export default defineEventHandler(event=>proxyCmsFile(event,getRouterParam(event,'id')||'',getQuery(event).variant==='thumbnail'));
