import test from 'node:test';
import assert from 'node:assert/strict';
import {proxyCmsFile} from '../server/utils/media-proxy.ts';

test('Les médias sont revalidés sans retransfert et restent soumis à leur publication',async t=>{
  const globals=globalThis as unknown as Record<string,unknown>;
  const names=['useRuntimeConfig','$fetch','getHeader','setHeader','setResponseStatus','sendStream','createError','fetch'];
  const previous=new Map(names.map(name=>[name,globals[name]]));
  t.after(()=>{for(const [name,value] of previous){if(value===undefined)delete globals[name];else globals[name]=value;}});
  let requestHeaders:Record<string,string>={},responseHeaders:Record<string,string>={},status=0,published=true,lookups=0;
  const requests:RequestInit[]=[];
  let upstream=()=>new Response('image',{headers:{etag:'"photo-v1"','last-modified':'Tue, 17 Nov 2026 10:00:00 GMT','content-type':'image/jpeg'}});
  Object.assign(globals,{
    useRuntimeConfig:()=>({cmsUrl:'http://cms:1337',mediaPublicBaseUrl:'https://bucket.example'}),
    $fetch:async()=>{lookups++;if(!published)throw Error('Unpublished');return {id:1,name:'photo.jpg',storageUrl:'https://bucket.example/photo.jpg'};},
    getHeader:(_:unknown,name:string)=>requestHeaders[name],
    setHeader:(_:unknown,name:string,value:string)=>{responseHeaders[name.toLowerCase()]=value;},
    setResponseStatus:(_:unknown,value:number)=>{status=value;},
    sendStream:(_:unknown,stream:ReadableStream)=>new Response(stream).text(),
    createError:(value:{statusCode:number})=>Object.assign(Error('HTTP '+value.statusCode),value),
    fetch:async(_:unknown,init:RequestInit)=>{requests.push(init);return upstream();},
  });
  const event={method:'GET'} as Parameters<typeof proxyCmsFile>[0];
  assert.equal(await proxyCmsFile(event,'1'),'image');
  assert.equal(status,200);assert.equal(responseHeaders.etag,'"photo-v1"');assert.equal(responseHeaders['cache-control'],'no-cache');
  assert(responseHeaders['last-modified']);

  requestHeaders={'if-none-match':'"photo-v1"'};responseHeaders={};
  upstream=()=>new Response(null,{status:304,headers:{etag:'"photo-v1"'}});
  assert.equal(await proxyCmsFile(event,'1'),'');assert.equal(status,304);assert.equal(lookups,2);
  assert.equal(new Headers(requests[1]?.headers).get('if-none-match'),'"photo-v1"');
  assert.equal(responseHeaders.etag,'"photo-v1"');

  requestHeaders={range:'bytes=0-4','if-range':'"photo-v1"'};
  upstream=()=>new Response('image',{status:206,headers:{'content-range':'bytes 0-4/100','accept-ranges':'bytes'}});
  assert.equal(await proxyCmsFile(event,'1'),'image');assert.equal(status,206);
  assert.equal(new Headers(requests[2]?.headers).get('range'),'bytes=0-4');
  assert.equal(new Headers(requests[2]?.headers).get('if-range'),'"photo-v1"');
  assert.equal(responseHeaders['content-range'],'bytes 0-4/100');

  published=false;requestHeaders={'if-none-match':'"photo-v1"'};
  await assert.rejects(()=>proxyCmsFile(event,'1'),{statusCode:404});
  assert.equal(lookups,4);assert.equal(requests.length,3);
});
