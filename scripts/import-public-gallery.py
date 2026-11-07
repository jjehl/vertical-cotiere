#!/usr/bin/env python3
"""Copy only guest-visible Piwigo albums, original photos and web thumbnails."""
from concurrent.futures import ThreadPoolExecutor
from html import unescape
from pathlib import Path
from urllib.parse import urlencode, urlparse, quote
from urllib.request import Request, urlopen
from hashlib import sha256
import json
import re
import time
import unicodedata

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'frontend/public/gallery'
DEST.mkdir(exist_ok=True)
CACHE=Path('/tmp/vc-gallery-import')
CACHE.mkdir(exist_ok=True)
BASE='https://www.vertical-cotiere.fr/albums/'

def read(url):
    for attempt in range(3):
        try:
            with urlopen(Request(quote(url,safe=':/?&=%+#'),headers={'User-Agent':'VerticalCotiere-public-gallery-migration/1.0'}),timeout=45) as response:return response.read()
        except Exception:
            if attempt==2:raise
            time.sleep(1)

def api(method,**params):
    url=BASE+'ws.php?'+urlencode({'format':'json','method':method,**params})
    cached=CACHE/(sha256(url.encode()).hexdigest()+'.json')
    data=json.loads(cached.read_bytes() if cached.exists() else read(url))
    if data.get('stat')!='ok':raise RuntimeError(str(data))
    cached.write_text(json.dumps(data,ensure_ascii=False))
    return data['result']

def images(category):
    result=[];page=0
    while True:
        response=api('pwg.categories.getImages',cat_id=category['id'],per_page=100,page=page)
        result.extend(response['images'])
        if len(result)>=response['paging']['total_count']:return result
        page+=1

def slug(value):
    return re.sub('[^a-z0-9]+','-',unicodedata.normalize('NFKD',unescape(value)).encode('ascii','ignore').decode().lower()).strip('-')

categories=[c for c in api('pwg.categories.getList',recursive='true')['categories'] if c['status']=='public']
print(f'{len(categories)} albums publics',flush=True)
by_album={}
with ThreadPoolExecutor(max_workers=6) as pool:
    for category,photos in zip(categories,pool.map(images,categories)):by_album[category['id']]=photos
unique={p['id']:p for photos in by_album.values() for p in photos}
print(f'{len(unique)} photos distinctes à récupérer',flush=True)

def download(photo):
    original=photo['element_url']
    thumb=photo.get('derivatives',{}).get('small',{}).get('url',original)
    paths={}
    try:
        for kind,url in [('original',original),('thumb',thumb)]:
            if urlparse(url).hostname not in ('www.vertical-cotiere.fr','vertical-cotiere.fr'):raise ValueError('Hôte de photo inattendu')
            extension=Path(urlparse(url).path).suffix.lower() or '.jpg'
            file=DEST/f"{photo['id']}-{kind}{extension}"
            if not file.exists():file.write_bytes(read(url))
            paths[kind]='/gallery/'+file.name
        return photo['id'],{'id':photo['id'],'title':unescape(photo.get('name') or photo['file']),'src':paths['original'],'thumb':paths['thumb'],'width':photo['width'],'height':photo['height']}
    except Exception as error:return photo['id'],{'error':str(error)}

photos={};errors=[]
with ThreadPoolExecutor(max_workers=6) as pool:
    for n,(photo_id,result) in enumerate(pool.map(download,unique.values()),1):
        if 'error' in result:errors.append({'id':photo_id,**result})
        else:photos[photo_id]=result
        if n%100==0:print(f'{n}/{len(unique)} photos traitées',flush=True)

albums=[];redirects={'categories':{},'photos':{}}
redirects['files']={}
for photo_id,photo in unique.items():
    if photo_id not in photos:continue
    redirects['files'][urlparse(photo['element_url']).path]=photos[photo_id]['src']
    for derivative in photo.get('derivatives',{}).values():redirects['files'][urlparse(derivative['url']).path]=photos[photo_id]['thumb']
for category in categories:
    name=unescape(category.get('name_raw') or category['name'])
    key=f"{category['id']}-{slug(name)}"
    items=[photos[p['id']] for p in by_album[category['id']] if p['id'] in photos]
    albums.append({'slug':key,'title':name,'description':re.sub('<[^>]+>','',unescape(category.get('comment_raw') or category.get('comment') or '')),'photos':items,'cover':items[0]['thumb'] if items else '', 'sourceId':str(category['id']),'parentId':str(category['id_uppercat']) if category.get('id_uppercat') else None})
    redirects['categories'][str(category['id'])]=key
    for photo in items:redirects['photos'].setdefault(str(photo['id']),key)
(ROOT/'content/gallery.json').write_text(json.dumps(albums,ensure_ascii=False,indent=2)+'\n')
(ROOT/'content/gallery-redirects.json').write_text(json.dumps(redirects,ensure_ascii=False,indent=2)+'\n')
report={'albums':len(albums),'sourcePhotos':len(unique),'importedPhotos':len(photos),'files':len(list(DEST.iterdir())),'bytes':sum(p.stat().st_size for p in DEST.iterdir()),'errors':errors}
(ROOT/'content/gallery-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2),flush=True)
