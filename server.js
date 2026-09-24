const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
const players = new Map();

function cleanName(name){
  return String(name || 'Player').replace(/[^\w\- äöüÄÖÜ]/g,'').trim().slice(0,18) || 'Player';
}
function snapshot(){
  return [...players.values()].map(p=>({id:p.id,name:p.name,online:p.online,lastSeen:p.lastSeen}));
}
function broadcast(obj){
  const msg=JSON.stringify(obj);
  for(const p of players.values()) if(p.ws && p.ws.readyState===WebSocket.OPEN) p.ws.send(msg);
}
function presence(){broadcast({type:'presence',players:snapshot()});}

const server=http.createServer((req,res)=>{
  if(req.url==='/health'){
    res.writeHead(200,{'Content-Type':'application/json'});
    return res.end(JSON.stringify({ok:true,online:[...players.values()].filter(p=>p.online).length}));
  }
  if(req.url==='/' || req.url==='/index.html'){
    const file=path.join(__dirname,'egg_raiders_3d_ONLINE.html');
    if(fs.existsSync(file)){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return fs.createReadStream(file).pipe(res);}
  }
  res.writeHead(404);res.end('Not found');
});

const wss=new WebSocket.Server({server});
wss.on('connection',(ws)=>{
  const id=Math.random().toString(36).slice(2,10);
  const player={id,ws,name:'Player',online:true,lastSeen:Date.now()};
  players.set(id,player);
  ws.send(JSON.stringify({type:'presence',id,players:snapshot()}));
  presence();

  ws.on('message',(raw)=>{
    let msg; try{msg=JSON.parse(raw.toString())}catch{return;}
    if(msg.type==='join' || msg.type==='update'){
      player.name=cleanName(msg.name);
      player.online=true; player.lastSeen=Date.now(); presence(); return;
    }
    if(msg.type==='adminAuth'){
      player.admin = player.name==='LinoA' && ADMIN_SECRET && msg.secret===ADMIN_SECRET;
      ws.send(JSON.stringify({type:'adminAuth',ok:!!player.admin})); return;
    }
    if(msg.type==='announcement' && player.admin){
      const text=String(msg.text||'').trim().slice(0,300);
      if(text) broadcast({type:'announcement',text,by:player.name,time:Date.now()});
    }
  });
  ws.on('close',()=>{player.online=false;player.lastSeen=Date.now();presence();});
  ws.on('error',()=>{});
});

setInterval(()=>{
  const now=Date.now();
  for(const p of players.values()){
    if(p.online && now-p.lastSeen>15000){p.online=false;presence();}
  }
},5000);

server.listen(PORT,'0.0.0.0',()=>console.log(`EGG RAIDERS server running on port ${PORT}`));
