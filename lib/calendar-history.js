const START='2026-10-01';
export const fallbackHistory={
 '2026-10-01':{kind:'game',text:'Minecraft Dungeons II'},
 '2026-10-02':{kind:'game',text:'7 Days to Die'},
 '2026-10-03':{kind:'chat',text:'雑談'},
 '2026-10-04':{kind:'chat',text:'雑談'},
 '2026-10-05':{kind:'game',text:'雑談 / 7 Days to Die'},
 '2026-10-06':{kind:'game',text:'7 Days to Die'},
 '2026-10-07':{kind:'rest',text:''},
 '2026-10-08':{kind:'game',text:'Airport Baggage Simulator'},
 '2026-10-09':{kind:'chat',text:'雑談'},
 '2026-10-10':{kind:'game',text:'PAPERHEAD'}
};

export function csvRows(csv){
 const rows=[];let row=[],value='',quoted=false;
 for(let i=0;i<csv.length;i++){
  const ch=csv[i];
  if(ch==='"'){if(quoted&&csv[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
  else if(ch===','&&!quoted){row.push(value);value='';}
  else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&csv[i+1]==='\n')i++;row.push(value);rows.push(row);row=[];value='';}
  else value+=ch;
 }
 if(value||row.length){row.push(value);rows.push(row);}
 return rows;
}

export function historyFromCsv(csv,{through}={}){
 const byDate=new Map();
 for(const row of csvRows(csv)){
  const match=String(row[1]||'').trim().match(/^(\d{1,2})月(\d{1,2})日$/);
  const category=String(row[7]||'').trim();
  if(!match||!category)continue;
  const key=`2026-${match[1].padStart(2,'0')}-${match[2].padStart(2,'0')}`;
  if(key<START)continue;
  const date=new Date(key+'T00:00:00Z');
  if(Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==key)continue;
  if(!byDate.has(key))byDate.set(key,[]);
  const categories=byDate.get(key);
  if(!categories.includes(category))categories.push(category);
 }
 if(!byDate.size)return {...fallbackHistory};
 const last=[...byDate.keys(),through].filter(Boolean).sort().at(-1);
 const result={};
 for(let day=new Date(START+'T00:00:00Z');day.toISOString().slice(0,10)<=last;day.setUTCDate(day.getUTCDate()+1)){
  const key=day.toISOString().slice(0,10),categories=byDate.get(key)||[];
  const text=categories.join(' / ');
  const kind=!categories.length?'rest':categories.some(item=>item!=='雑談')?'game':'chat';
  result[key]={kind,text:text.slice(0,90)};
 }
 return result;
}
