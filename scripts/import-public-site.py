#!/usr/bin/env python3
"""Import public WordPress content into portable JSON and local assets (no credentials).

Run explicitly to refresh the snapshot; it never writes to the running CMS.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
from hashlib import sha256
from html import escape, unescape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import time
from urllib.parse import urljoin, urlparse, unquote, parse_qs, quote
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://www.vertical-cotiere.fr/'
HOSTS = {'vertical-cotiere.fr', 'www.vertical-cotiere.fr'}
CACHE = Path('/tmp/vertical-cotiere-import')
CACHE.mkdir(exist_ok=True)
ASSETS = ROOT / 'frontend/public/imports'
ASSETS.mkdir(exist_ok=True)

def fetch(url):
    url = url.replace('http://www.vertical-cotiere.fr', 'https://www.vertical-cotiere.fr')
    url = quote(url, safe=':/?&=%+#')
    key = CACHE / sha256(url.encode()).hexdigest()
    if key.exists():
        return key.read_bytes()
    for attempt in range(3):
        try:
            with urlopen(Request(url, headers={'User-Agent': 'VerticalCotiere-content-migration/1.0'}), timeout=30) as r:
                data = r.read()
            key.write_bytes(data)
            return data
        except Exception:
            if attempt == 2: raise
            time.sleep(1)

def api(path, key=None):
    result, page = [], 1
    while True:
        url = BASE + 'wp-json/' + path + ('&' if '?' in path else '?') + f'page={page}&per_page=100'
        data = json.loads(fetch(url))
        rows = data[key] if key else data
        result.extend(rows)
        if (key and page >= data['total_pages']) or (not key and len(rows) < 100): return result
        page += 1

def plain(value):
    return re.sub(r'\s+', ' ', unescape(re.sub(r'<[^>]+>', ' ', value))).strip()

def local_path(url): return unquote(urlparse(urljoin(BASE, url)).path).rstrip('/') or '/'

pages = api('wp/v2/pages')
posts = api('wp/v2/posts')
events = api('tribe/events/v1/events?start_date=1900-01-01&end_date=2100-12-31', 'events')
categories = {x['id']: plain(x['name']) for x in api('wp/v2/categories')}
initial = json.loads((ROOT / 'content/initial.json').read_text())
prototype = ROOT / 'content/prototype.json'
if not prototype.exists(): prototype.write_text(json.dumps(initial, ensure_ascii=False, indent=2) + '\n')

targets = {}
page_ids = {}
overrides = {'presentation': '/le-club', 'horaires': '/horaires-et-acces#horaires', 'acces': '/horaires-et-acces#acces', 'contacts': '/contact', 'inscriptions_25-26': '/inscriptions#modalites'}
for p in pages:
    target = overrides.get(p['slug'], '/ressources/' + p['slug'])
    if local_path(p['link']) == '/': target = '/ressources/dernieres-infos'
    targets[local_path(p['link'])] = target
    page_ids[str(p['id'])] = target
targets['/'] = '/'
for p in posts: targets[local_path(p['link'])] = '/actualites/' + p['slug']; page_ids[str(p['id'])] = targets[local_path(p['link'])]
for e in events: targets[local_path(e['url'])] = '/agenda/' + e['slug']; page_ids[str(e['id'])] = targets[local_path(e['url'])]
targets.update({'/inscriptions':'/inscriptions', '/competitions':'/ressources/competition', '/competitions__trashed/coupe-de-lain':'/ressources/coupe-de-lain'})
targets['/agenda/baby-escalade-14-novembre-2026'] = '/agenda/baby-escalade-4'

class Links(HTMLParser):
    def __init__(self): super().__init__(); self.urls = set()
    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key in ('href', 'src') and value: self.urls.add(urljoin(BASE, unescape(value)))

documents = [p['content']['rendered'] for p in pages+posts] + [e['description'] for e in events]
# Include the documents linked directly from the public navigation.
documents.append(fetch(BASE).decode('utf-8'))
links = Links()
for document in documents: links.feed(document)
unavailable = []
extra_pages = []

class Entry(HTMLParser):
    def __init__(self): super().__init__(); self.depth=0; self.capture=None; self.parts=[]; self.title=False; self.heading=[]
    def handle_starttag(self,t,a):
        d=dict(a)
        if t=='h1': self.title=True
        if t=='div' and 'entry-content' in d.get('class',''): self.capture=self.depth
        if t=='div': self.depth+=1
        if self.capture is not None and not (t=='div' and self.depth==self.capture+1): self.parts.append(self.get_starttag_text())
    def handle_endtag(self,t):
        if t=='h1': self.title=False
        if t=='div':
            self.depth-=1
            if self.depth==self.capture: self.capture=None; return
        if self.capture is not None: self.parts.append(f'</{t}>')
    def handle_data(self,d):
        if self.title: self.heading.append(d)
        if self.capture is not None: self.parts.append(escape(d))

def discover(url):
    try:
        parser=Entry(); parser.feed(fetch(url).decode('utf-8'))
        body=''.join(parser.parts)
        title=''.join(parser.heading).strip()
        if not body.strip() or not title: raise ValueError('Contenu public absent')
        return {'slug':local_path(url).strip('/').replace('/','-'), 'title':title, 'html':body, 'path':local_path(url)}
    except Exception as error: return {'missing':local_path(url), 'reason':str(error)}

unknown = sorted({u for u in links.urls if urlparse(u).hostname in HOSTS and local_path(u) not in targets and not local_path(u).startswith(('/wp-', '/events', '/evenements', '/index.php/events', '/category', '/author', '/tag', '/feed', '/xmlrpc.php')) and '@' not in local_path(u)})
with ThreadPoolExecutor(max_workers=5) as pool:
    for item in pool.map(discover, unknown):
        if 'missing' in item: unavailable.append(item)
        else:
            targets[item['path']]='/ressources/'+item['slug']; extra_pages.append(item); links.feed(item['html'])

assets = {}
asset_errors = []
def download(url):
    path=local_path(url)
    filename = re.sub(r'[^a-zA-Z0-9._-]+','-',unquote(urlparse(url).path).split('/')[-1])
    name=sha256(path.encode()).hexdigest()[:12]+'-'+filename
    destination=ASSETS/name
    try:
        if not destination.exists(): destination.write_bytes(fetch(BASE.rstrip('/')+urlparse(url).path))
        return path, '/imports/'+name
    except Exception as error:
        return path, {'error':str(error)}

asset_urls = {u for u in links.urls if urlparse(u).hostname in HOSTS and local_path(u).startswith('/wp-content/uploads/')}
for e in events:
    if e.get('image'): asset_urls.add(e['image']['url'])
with ThreadPoolExecutor(max_workers=6) as pool:
    for path, result in pool.map(download, sorted(asset_urls)):
        if isinstance(result, str): assets[path]=result
        else: asset_errors.append({'path':path, **result})

def rewrite(url, base=BASE):
    if not url: return None
    if url.startswith('#'): return url
    absolute=urljoin(base,unescape(url)); parsed=urlparse(absolute)
    if parsed.scheme not in ('http','https','mailto','tel','webcal'): return None
    if parsed.hostname not in HOSTS: return absolute
    path=local_path(absolute)
    if '@' in path: return 'mailto:'+path.strip('/')
    if path in assets: return assets[path]
    if path in targets:
        target=targets[path]
        return target + ('#'+parsed.fragment if parsed.fragment and '#' not in target else '')
    query=parse_qs(parsed.query)
    for key in ('p','page_id'):
        if query.get(key) and query[key][0] in page_ids:return page_ids[query[key][0]]
    if query.get('ical') or parsed.scheme=='webcal': return '/api/agenda.ics'
    if path.startswith(('/events','/evenements','/index.php/events')):
        category = 'Compétition' if 'competition' in path else 'Sortie' if 'sorties' in path or 'falaise' in path else 'Stage' if 'stages' in path else ''
        return '/agenda'+('?categorie='+category if category else '')
    if path.startswith(('/category','/author','/tag')):return '/actualites'
    if path=='/albums':return '/albums'
    return None

class Clean(HTMLParser):
    allowed=set('p br strong b em i h2 h3 h4 h5 ul ol li table thead tbody tfoot tr th td blockquote figure figcaption img a hr span div s del sub sup details summary'.split())
    void={'br','hr','img'}
    def __init__(self,base=BASE): super().__init__(convert_charrefs=True); self.base=base;self.output=[];self.skip=0;self.stack=[]
    def handle_starttag(self,tag,attrs):
        if tag in ('script','style','iframe','object','form'):self.skip+=1;return
        if self.skip or tag not in self.allowed:return
        a=dict(attrs); safe={}
        if tag=='a':
            url=rewrite(a.get('href'),self.base)
            if not url: self.stack.append((tag,'span'));self.output.append('<span>');return
            safe['href']=url
            if url.startswith(('http://','https://')):safe.update(target='_blank',rel='noopener noreferrer')
        if tag=='img':
            src=rewrite(a.get('src'),self.base)
            if not src:return
            safe.update(src=src,alt=a.get('alt',''),loading='lazy')
        for key in ('id','title','colspan','rowspan'):
            if key in a and a[key]:safe[key]=a[key]
        self.output.append('<'+tag+''.join(' '+k+'="'+escape(v,quote=True)+'"' for k,v in safe.items())+'>')
        if tag not in self.void:self.stack.append((tag,tag))
    def handle_endtag(self,tag):
        if tag in ('script','style','iframe','object','form'):
            self.skip=max(0,self.skip-1);return
        if self.skip or tag not in self.allowed or tag in self.void:return
        # WordPress sometimes contains unbalanced markup; close only known tags.
        indices=[i for i,(original,_) in enumerate(self.stack) if original==tag]
        if indices:
            i=indices[-1]
            for _,actual in reversed(self.stack[i:]):self.output.append('</'+actual+'>')
            self.stack=self.stack[:i]
    def handle_data(self,data):
        if not self.skip:self.output.append(escape(data))
    def result(self):
        return ''.join(self.output)+''.join('</'+tag+'>' for _,tag in reversed(self.stack))

def sanitize(value,base=BASE):
    parser=Clean(base);parser.feed(value);return parser.result()

def group(slug):
    if any(k in slug for k in ('competition','coupe','equipe')):return 'Compétitions'
    if any(k in slug for k in ('stage','baby','decouverte','perfectionnement')):return 'Stages et cours'
    if any(k in slug for k in ('sortie','randonnee')):return 'Sorties nature'
    if any(k in slug for k in ('securite','technique','lecture','pedagogique','liens')):return 'Documents et ressources'
    if any(k in slug for k in ('partenaire','club-dans','clubs-dans','bon-plan','cordonnier')):return 'Partenaires'
    return 'Le club'

result={'activities':initial['activities'],'events':[],'news':[],'pages':[]}
for p in pages:
    slug='dernieres-infos' if local_path(p['link'])=='/' else p['slug']
    result['pages'].append({'slug':slug,'title':plain(p['title']['rendered']),'bodyHtml':sanitize(p['content']['rendered'],p['link']),'sourceId':str(p['id']),'oldPath':local_path(p['link']),'group':group(slug),'structuredData':None})
for p in extra_pages:
    result['pages'].append({'slug':p['slug'],'title':p['title'],'bodyHtml':sanitize(p['html']),'sourceId':p['path'],'oldPath':p['path'],'group':group(p['slug']),'structuredData':None})
for p in posts:
    cats=[categories[c] for c in p['categories'] if c in categories]
    body=sanitize(p['content']['rendered'],p['link'])
    cover=re.search(r'<img[^>]+src="([^"]+)"',body)
    result['news'].append({'slug':p['slug'],'title':plain(p['title']['rendered']),'category':', '.join(cats) or 'Vie du club','summary':plain(p['excerpt']['rendered'])[:300],'body':plain(p['content']['rendered']),'bodyHtml':body,'date':p['date'][:10],'image':cover.group(1) if cover else '/images/nature.jpg','sourceId':str(p['id']),'sourceUrl':'','oldPath':local_path(p['link'])})
for e in events:
    tags=[plain(c['name']) for c in e['categories']]
    haystack=(' '.join(tags)+' '+plain(e['title'])).lower()
    category='Compétition' if any(s in haystack for s in ('compétition','competition','coupe','contest','challenge')) else 'Sortie' if any(s in haystack for s in ('sortie','falaise','familles','calanque')) else 'Cours' if 'baby' in haystack or 'cours' in haystack else 'Stage' if 'stage' in haystack else 'Vie du club'
    date=lambda v:datetime.strptime(v,'%Y-%m-%d %H:%M:%S').replace(tzinfo=timezone.utc).isoformat().replace('+00:00','Z')
    body=sanitize(e['description'],e['url'])
    link=Links();link.feed(e['description'])
    participation=next((rewrite(u) for u in sorted(link.urls) if urlparse(u).hostname in ('www.helloasso.com','helloasso.com','sondage.vertical-cotiere.fr','framadate.org')),None)
    end_date=e['end_date'][:10]
    if e['all_day']:end_date=(datetime.fromisoformat(end_date)+timedelta(days=1)).date().isoformat()
    venue=e.get('venue') or {};venue=venue if isinstance(venue,dict) else {}
    location=', '.join(str(venue[k]) for k in ('venue','address','city') if venue.get(k))
    epoch=lambda v:int(datetime.strptime(v,'%Y-%m-%d %H:%M:%S').replace(tzinfo=timezone.utc).timestamp())
    uid=f"{e['id']}-{epoch(e['start_date'])}-{epoch(e['end_date'])}@www.vertical-cotiere.fr"
    result['events'].append({'slug':e['slug'],'title':plain(e['title']),'category':category,'tags':tags,'summary':plain(e.get('excerpt') or e['description'])[:250],'body':plain(e['description']),'bodyHtml':body,'start':date(e['utc_start_date']),'end':date(e['utc_end_date']),'allDay':e['all_day'],'startDate':e['start_date'][:10],'endDate':end_date,'location':location or 'Lieu à préciser par le club','participationUrl':participation,'participationLabel':'S’inscrire / participer','eventState':'prévu','image':assets.get(local_path(e['image']['url']),'') if e.get('image') else '', 'sourceId':str(e['id']),'calendarUid':uid,'oldPath':local_path(e['url'])})

# Preserve the authoritative source images, alongside a separately verified text transcription.
plan=json.loads((ROOT/'content/timetable.json').read_text()) if (ROOT/'content/timetable.json').exists() else None
for page in result['pages']:
    if page['slug']=='horaires':page['structuredData']=plan

(ROOT/'content/initial.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
report={'importedAt':datetime.now(timezone.utc).isoformat(),'counts':{k:len(v) for k,v in result.items()},'assets':len(assets),'missingAssets':asset_errors,'unavailablePages':unavailable,'redirects':targets,'idRedirects':page_ids,'assetRedirects':assets,'source':'https://www.vertical-cotiere.fr/','eventRange':'1900–2100 (all events exposed by the public API)'}
(ROOT/'content/import-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k not in ('redirects','assetRedirects')},ensure_ascii=False,indent=2))
