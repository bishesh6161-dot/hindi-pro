export async function requestJson(url, options={}) {
  const r=await fetch(url,{...options,headers:{'user-agent':'YumeZoneScraper/1.0','accept':'application/json',...(options.headers||{})}});
  const body=await r.text();
  let data; try { data=body?JSON.parse(body):{}; } catch { throw new Error(`Expected JSON from upstream (${r.status})`); }
  if(!r.ok) throw new Error(`Upstream HTTP ${r.status}: ${JSON.stringify(data).slice(0,300)}`);
  return data;
}
export const YUME='https://yumezone.live';
export const AL='https://graphql.anilist.co/';
export async function anilist(query,variables={}) {
 return requestJson(AL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query,variables})});
}
