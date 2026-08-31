const CACHE='finanx-v4-safe-shell';
const CORE=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./icon-192.svg','./icon-512.svg','./icon-maskable.svg'];
const SENSITIVE_KEYS=['token','access_token','refresh_token','id_token','password','passwd','session','session_id','code','credential','credentials','apikey','api_key','secret'];
const PRIVATE_PATHS=['/api/','/auth/','/login','/logout','/session','/account','/profile','/admin'];
function isSensitiveRequest(req,url){
  if(req.headers.get('authorization')||req.headers.get('cookie')) return true;
  const lower=(url.pathname+url.search).toLowerCase();
  if(PRIVATE_PATHS.some(p=>lower.includes(p))) return true;
  for(const key of SENSITIVE_KEYS){ if(url.searchParams.has(key)||lower.includes(key+'=')) return true; }
  return false;
}
function cacheableResponse(res){
  if(!res||!res.ok||res.type==='opaque') return false;
  const cc=(res.headers.get('cache-control')||'').toLowerCase();
  if(cc.includes('private')||cc.includes('no-store')) return false;
  if(res.headers.has('set-cookie')) return false;
  return true;
}
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    for(const asset of CORE){
      try{
        const res=await fetch(asset,{credentials:'omit',cache:'no-store'});
        if(cacheableResponse(res)) await cache.put(asset,res.clone());
      }catch(_){ }
    }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin) return;
  if(isSensitiveRequest(req,url)) return;
  if(req.mode==='navigate'){
    event.respondWith(fetch(req,{cache:'no-store'}).catch(()=>caches.match('./index.html')));
    return;
  }
  const coreUrl=new URL(req.url);
  const coreMatch=CORE.some(asset=>new URL(asset,self.registration.scope).pathname===coreUrl.pathname);
  if(!coreMatch) return;
  event.respondWith((async()=>{
    const cached=await caches.match(req,{ignoreSearch:true});
    try{
      const response=await fetch(req,{credentials:'omit'});
      if(cacheableResponse(response)){
        const cache=await caches.open(CACHE);
        await cache.put(req,response.clone());
      }
      return response;
    }catch(_){
      if(cached) return cached;
      throw _;
    }
  })());
});
self.addEventListener('message',event=>{if(event.data&&event.data.type==='SKIP_WAITING')self.skipWaiting();});