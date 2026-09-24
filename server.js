const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = Number(process.env.PORT) || 10000;
const HOST = '0.0.0.0';
const ADMIN_SECRET = String(process.env.ADMIN_SECRET || '');
const CLIENT = path.join(__dirname, 'egg_raiders_3d_ONLINE.html');
const players = new Map();

const server = http.createServer((req,res)=>{
  if(req.url === '/health'){ res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}); return res.end('ok'); }
  if(req.url === '/' || req.url.startsWith('/egg_raiders_3d_ONLINE.html')){
    fs.readFile(CLIENT,(err,data)=>{ if(err){res.writeHead(500);return res.end('Client not found');} res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(data); });
    return;
  }
  res.writeHead(404);res.end('Not found');
});
const wss = new WebSocket.Server({server});
function send(ws,msg){ if(ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify(msg)); }
function broadcast(msg,except){ for(const p of players.values()) if(p.ws!==except) send(p.ws,msg); }
function publicPlayer(p){ return {id:p.id,name:p.name,x:p.x,z:p.z,rot:p.rot}; }
function count(){return players.size;}
function validName(n){return String(n||'Player').replace(/[^a-zA-Z0-9 _-]/g,'').slice(0,20)||'Player';}

wss.on('connection',(ws)=>{
  const id=Math.random().toString(36).slice(2)+Date.now().toString(36);
  let player=null;
  ws.on('message',(raw)=>{
    let m; try{m=JSON.parse(raw.toString())}catch{return;}
    if(m.type==='join'){
      if(player)return;
      player={id,ws,name:validName(m.name),x:0,z:18,rot:0,admin:false};
      players.set(id,player);
      send(ws,{type:'welcome',id,count:count(),players:[...players.values()].filter(p=>p.id!==id).map(publicPlayer)});
      broadcast({type:'player_joined',...publicPlayer(player),count:count()},ws);
      return;
    }
    if(!player)return;
    if(m.type==='move'){
      player.x=Math.max(-118,Math.min(118,Number(m.x)||0));
      player.z=Math.max(-118,Math.min(118,Number(m.z)||18));
      player.rot=Number(m.rot)||0;
      broadcast({type:'player_move',id:player.id,x:player.x,z:player.z,rot:player.rot},ws);
    }
    if(m.type==='admin_auth'){
      player.admin = Boolean(ADMIN_SECRET) && String(m.secret||'') === ADMIN_SECRET && player.name === 'LinoA';
      send(ws,{type:'admin_auth_result',ok:player.admin});
    }
    if(m.type==='admin_announcement'){
      if(player.name!=='LinoA' || !player.admin) return;
      const text=String(m.text||'').trim().slice(0,180); if(!text)return;
      broadcast({type:'announcement',text,by:'LinoA'});
      send(ws,{type:'announcement',text,by:'LinoA'});
    }
  });
  ws.on('close',()=>{
    if(player){players.delete(player.id);broadcast({type:'player_left',id:player.id,count:count()});}
  });
});
setInterval(()=>broadcast({type:'server_info',count:count()}),5000);
server.listen(PORT,HOST,()=>console.log(`EGG RAIDERS online server listening on ${HOST}:${PORT}`));
