const { Rooms } = require('./room.js');
const sent = [];
const bc = (room, obj) => sent.push({ to: 'all', t: obj.t, obj });
const to = (conn, obj) => sent.push({ to: conn && conn.id, t: obj.t, obj });
const R = new Rooms(bc, to);
function conn(id) { return { id, socket: {}, roomCode: null }; }
const c1 = conn('h'), c2 = conn('a'), c3 = conn('b'), c4 = conn('c');
R.handle(c1, { t: 'host', name: 'Host', color: 'red' });
const code = c1.roomCode;
R.handle(c2, { t: 'join', code, name: 'A', color: 'blue' });
R.handle(c3, { t: 'join', code, name: 'B', color: 'green' });
R.handle(c4, { t: 'join', code, name: 'C', color: 'pink' });
const room = R.find(code);
console.log('lobby players:', room.players.length, 'code:', code);
R.handle(c1, { t: 'start', settings: { numImpostors: 1, tasksPerCrew: 2, discussTime: 0.2, voteTime: 0.2, killCooldown: 1, reactorCountdown: 5 } });
console.log('phase after start:', room.phase, 'impostors:', room.players.filter(p => p.role === 'impostor').map(p => p.name));
const imp = room.players.find(p => p.role === 'impostor');
const victim = room.players.find(p => p.role !== 'impostor');
imp.killCool = 0;
R.handle(imp.conn, { t: 'kill', victimId: victim.id });
console.log('victim alive after kill:', victim.alive, 'aliveImp:', room.aliveImp().length, 'aliveCrew:', room.aliveCrew().length);
const crewP = room.players.filter(p => p.role !== 'impostor' && p.alive);
R.handle(crewP[0].conn, { t: 'task' });
console.log('taskPct after 1 task:', room.taskPct());
R.handle(crewP[0].conn, { t: 'report' });
console.log('phase after report:', room.phase, 'meeting phase:', room.meeting && room.meeting.phase);
// advance discuss -> vote
for (let i = 0; i < 4 && room.meeting && room.meeting.phase === 'discuss'; i++) R.tick(0.1);
console.log('meeting phase now:', room.meeting && room.meeting.phase);
for (const p of room.alive()) R.handle(p.conn, { t: 'vote', target: imp.id });
// vote() ends timer early when all voted; tick to resolve
for (let i = 0; i < 5 && room.phase === 'meeting'; i++) R.tick(0.1);
console.log('phase after votes/ticks:', room.phase, 'impAlive:', room.aliveImp().length);
const overs = sent.filter(s => s.t === 'over');
console.log('over fired:', overs.length > 0, 'text:', overs.map(s => s.obj.text), 'crewWon:', overs.map(s => s.obj.crewWon));
clearInterval(R._t);
