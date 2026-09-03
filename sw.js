const CACHE='finanx-v7-safe-shell';
const CACHE_PREFIX='finanx-';
const CORE=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./icon-192.svg','./icon-512.svg','./icon-maskable.svg'];
const SENSITIVE_KEYS=['token','access_token','refresh_token','id_token','password','passwd','session','session_id','code','credential','credentials','apikey','api_key','secret'];
const PRIVATE_PATHS=['/api/','/auth/','/login','/logout','/session','/account','/profile','/admin'];
function isSensitiveRequest(req,url){
  if(req.headers.get('authorization')||req.headers.get('cookie')) return true;
  if(req.headers.has('range')||req.headers.has('if-range')) return true;
  const lower=(url.pathname+url.search).toLowerCase();
  if(PRIVATE_PATHS.some(p=>lower.includes(p))) return true;
  for(const key of SENSITIVE_KEYS){ if(url.searchParams.has(key)||lower.includes(key+'=')) return true; }
  return false;
}
function cacheableResponse(res){
  if(!res||!res.ok||res.type==='opaque'||res.status===206||res.redirected) return false;
  const cc=(res.headers.get('cache-control')||'').toLowerCase();
  if(cc.includes('private')||cc.includes('no-store')) return false;
  if(res.headers.has('set-cookie')||res.headers.has('content-range')) return false;
  return true;
}
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    for(const asset of CORE){
      try{
        const res=await fetch(asset,{credentials:'omit',cache:'no-store',redirect:'error'});
        if(cacheableResponse(res)) await cache.put(asset,res.clone());
      }catch(_){ }
    }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys
      .filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE)
      .map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET'||req.headers.has('range')||req.headers.has('if-range')) return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin) return;
  if(isSensitiveRequest(req,url)) return;
  if(req.mode==='navigate'){
    event.respondWith(fetch(req,{cache:'no-store',redirect:'error'}).catch(()=>caches.match('./index.html')));
    return;
  }
  const coreUrl=new URL(req.url);
  const coreMatch=CORE.some(asset=>new URL(asset,self.registration.scope).pathname===coreUrl.pathname);
  if(!coreMatch) return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const cached=await cache.match(req,{ignoreSearch:true});
    try{
      const response=await fetch(req,{credentials:'omit',cache:'no-store',redirect:'error'});
      if(cacheableResponse(response)) await cache.put(req,response.clone());
      return response;
    }catch(error){
      if(cached) return cached;
      throw error;
    }
  })());
});
self.addEventListener('message',event=>{if(event.data&&event.data.type==='SKIP_WAITING')self.skipWaiting();});
