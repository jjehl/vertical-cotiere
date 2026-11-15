export function memberReturnPath(value:unknown):string {
  return typeof value==='string'&&(value==='/inscriptions'||/^\/vie-du-club\/[a-zA-Z0-9_-]{1,200}$/.test(value))?value:'/compte';
}
