export function parseHls(text, baseUrl) {
 const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 const audio=[], subtitles=[], variants=[], segments=[];
 for(let i=0;i<lines.length;i++){
  const line=lines[i];
  if(line.startsWith('#EXT-X-MEDIA:')){
   const a=Object.fromEntries([...line.matchAll(/([A-Z-]+)=("([^"]*)"|([^,]*))/g)].map(m=>[m[1],m[3]??m[4]]));
   const item={type:a.TYPE,name:a.NAME,language:a.LANGUAGE,default:a.DEFAULT==='YES',autoselect:a.AUTOSELECT==='YES',url:a.URI?new URL(a.URI,baseUrl).href:null};
   if(a.TYPE==='AUDIO')audio.push(item); if(a.TYPE==='SUBTITLES')subtitles.push(item);
  } else if(line.startsWith('#EXT-X-STREAM-INF:')){
   const a=Object.fromEntries([...line.matchAll(/([A-Z0-9-]+)=("([^"]*)"|([^,]*))/g)].map(m=>[m[1],m[3]??m[4]]));
   const next=lines[i+1]; if(next&&!next.startsWith('#')) variants.push({bandwidth:Number(a.BANDWIDTH)||null,resolution:a.RESOLUTION||null,codecs:a.CODECS||null,url:new URL(next,baseUrl).href});
  } else if(!line.startsWith('#')) segments.push(new URL(line,baseUrl).href);
 }
 return {isMaster:variants.length>0,audio,subtitles,variants,segments};
}
