const prefix='STRAPI_LIST_VIEW_DISPLAYED_HEADERS:api::publication.publication';

// Strapi keeps per-instance column selections in the browser. Upgrade existing
// selections once; later manual choices (including hiding this column) remain.
export function migratePublicationColumns(storage) {
  try {
    const keys=Array.from({length:storage.length},(_,index)=>storage.key(index));
    for(const key of keys) {
      if(key!==prefix&&!key?.startsWith(prefix+':'))continue;
      const marker='VC_EVENT_DATE_COLUMN_V1:'+key;
      if(storage.getItem(marker))continue;
      let columns;
      try { columns=JSON.parse(storage.getItem(key)); } catch { continue; }
      if(!Array.isArray(columns)||!columns.every(value=>typeof value==='string'))continue;
      if(!columns.includes('eventDate')) {
        const after=columns.indexOf('date');
        columns.splice(after<0?columns.length:after+1,0,'eventDate');
        storage.setItem(key,JSON.stringify(columns));
      }
      storage.setItem(marker,'1');
    }
  } catch { /* Private browsing or disabled storage must not block the admin. */ }
}
