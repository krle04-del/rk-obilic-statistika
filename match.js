// RK Obilic - modul utakmica v0.5
let currentMatch = Database.load().draftMatch || null;
let correctionMode = false;
let competitionFilter = 'all';
const matchStyle = document.createElement('style');
matchStyle.textContent = `
.live-player{padding:10px;margin-bottom:8px}.live-player-header{margin-bottom:6px}.stat-buttons button{padding:8px 3px;min-height:48px}.stat-buttons strong{display:block;font-size:20px}.stat-buttons small{display:block}.match-tools{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.match-tools button{flex:1;min-height:42px}.half-line{font-size:14px;margin-top:10px}.match-count{position:sticky;bottom:0;background:#eef2f7;padding:10px 0;z-index:5}.match-edit{background:#fff2c9;padding:10px;border-radius:8px}.scoreboard{padding:12px}.score{font-size:36px}.match-danger{color:#a52230}.match-tools .selected-mode{background:#10284a;color:white}.match-filter{margin:15px 0}.live-player .player-number{width:40px;height:40px;font-size:20px}.live-player .player-name{font-size:15px}
`;
document.head.appendChild(matchStyle);

function getMatchGoals(m){return m.players.reduce((s,p)=>s+Number(p.goals||0)+Number(p.penalties||0),0);}
function matchClone(m){return JSON.parse(JSON.stringify(m));}
function storeDraft(next){
    try{const d=Database.load();d.draftMatch=next;Database.save(d);currentMatch=next;return true;}
    catch(e){alert('Podaci nisu sačuvani: '+e.message);return false;}
}
function mutateMatch(fn){
    if(!currentMatch)return;
    const next=matchClone(currentMatch);fn(next);
    if(storeDraft(next))showLiveMatch(true);
}
function showNewMatch(){
    if(currentMatch){showLiveMatch();return;}
    const players=seasonPlayers().filter(p=>p.active).sort((a,b)=>a.number-b.number);
    if(!players.length){alert('Prvo unesi aktivne igrače.');showPlayers();return;}
    const now=new Date();const date=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
    main.innerHTML=`<div class="module-toolbar"><button class="secondary-button" onclick="showHome()">← Početna</button></div><h2>Nova utakmica</h2>
    <form id="newMatchForm"><div class="form-panel"><div class="form-grid">
    <div class="form-field"><label>Protivnik *</label><input name="opponent" required></div>
    <div class="form-field"><label>Datum *</label><input type="date" name="date" value="${date}" required></div>
    <div class="form-field"><label>Kolo *</label><input name="round" required></div>
    <div class="form-field"><label>Takmičenje</label><select name="competition"><option>Super B liga</option><option>Kup Srbije</option><option>Prijateljska utakmica</option><option>Ostalo</option></select></div>
    <div class="form-field"><label>Domaćinstvo</label><select name="venue"><option value="home">Domaćin</option><option value="away">Gost</option></select></div></div></div>
    <h3>Izaberi sastav</h3>${players.map(p=>`<label class="player-row squad-row"><input type="checkbox" name="players" value="${escapeHTML(p.id)}" onchange="updateSquadCount()"><div class="player-number">${escapeHTML(p.number)}</div><div class="player-info"><div class="player-name">${escapeHTML(p.firstName)} ${escapeHTML(p.lastName)}</div><div class="player-details">${escapeHTML(p.position)}</div></div></label>`).join('')}
    <div class="match-count"><strong id="squadCount">Izabrano: 0 igrača</strong><button type="submit" class="action-button full-button">ZAPOČNI UTAKMICU</button></div></form>`;
    document.getElementById('newMatchForm').addEventListener('submit',startMatch);
}
function updateSquadCount(){document.getElementById('squadCount').textContent='Izabrano: '+document.querySelectorAll('#newMatchForm input[name="players"]:checked').length+' igrača';}
function startMatch(event){
    event.preventDefault();if(currentMatch)return;
    const f=new FormData(event.target);const selected=f.getAll('players');const opponent=f.get('opponent').trim();const round=f.get('round').trim();
    if(!opponent||!round||!selected.length){alert('Unesi protivnika, kolo i izaberi sastav.');return;}
    const data=Database.load();
    if(data.matches.some(m=>m.season===data.activeSeason&&m.competition===f.get('competition')&&m.round===round&&m.date===f.get('date')&&m.opponent.trim().toLowerCase()===opponent.toLowerCase())){alert('Ovakva utakmica već postoji. Otvori je u arhivi.');return;}
    const m={id:Date.now().toString()+Math.random().toString(36).slice(2,7),season:data.activeSeason,opponent,date:f.get('date'),round,competition:f.get('competition'),venue:f.get('venue'),opponentGoals:0,mvp:null,halfTime:null,history:[],players:seasonPlayers().filter(p=>p.active&&selected.includes(p.id)).sort((a,b)=>a.number-b.number).map(p=>({id:p.id,number:p.number,firstName:p.firstName,lastName:p.lastName,goals:0,penalties:0,exclusions:0,redCards:0}))};
    correctionMode=false;if(storeDraft(m))showLiveMatch();
}
function showLiveMatch(keepScroll=false){
    if(!currentMatch){showNewMatch();return;}
    const y=window.scrollY;const m=currentMatch;const sign=correctionMode?'−':'+';
    main.innerHTML=`<div class="module-toolbar"><button class="secondary-button" onclick="showHome()">← Početna</button><span>${m.editing?'Izmena završene utakmice':'Utakmica u toku'}</span></div>
    <div class="scoreboard"><div class="match-round">${escapeHTML(m.competition)} | ${escapeHTML(m.round)}. kolo</div><div class="scoreboard-teams"><div>OBILIĆ<div class="score">${getMatchGoals(m)}</div></div><div class="score-divider">:</div><div>${escapeHTML(m.opponent)}<div class="score">${m.opponentGoals}</div></div></div>
    <div class="opponent-controls"><button onclick="opponentGoal(-1)">−</button><button onclick="opponentGoal(1)">+ GOL PROTIVNIKA</button></div>
    <div class="half-line">${m.halfTime?'Poluvreme: '+m.halfTime.own+' : '+m.halfTime.opponent:'Poluvreme nije zabeleženo'}</div><div class="opponent-controls"><button onclick="recordHalfTime()">${m.halfTime?'Izmeni poluvreme':'Zabeleži poluvreme'}</button></div></div>
    <div class="match-tools"><button class="secondary-button ${!correctionMode?'selected-mode':''}" onclick="setCorrection(false)">+ Unos</button><button class="secondary-button ${correctionMode?'selected-mode':''}" onclick="setCorrection(true)">− Ispravka</button><button class="secondary-button" onclick="undoLastStat()">↶ Poništi</button></div>
    ${correctionMode?'<p class="match-edit">Režim ispravke: dugmad oduzimaju po jedan unos.</p>':''}
    <h3>Statistika igrača (${m.players.length})</h3>
    ${m.players.map((p,i)=>`<div class="live-player"><div class="live-player-header"><div class="player-number">${escapeHTML(p.number)}</div><div class="player-info"><div class="player-name">${escapeHTML(p.firstName)} ${escapeHTML(p.lastName)}</div><div class="player-details">Ukupno golova: ${p.goals+p.penalties}</div></div><button class="mvp-button ${m.mvp===p.id?'mvp-active':''}" aria-label="MVP" onclick="selectMVP(${i})">🏆</button></div><div class="stat-buttons">${[['goals','GOL','goal-button'],['penalties','7m','penalty-button'],['exclusions',"2′",'exclusion-button'],['redCards','CK','red-button']].map(([k,l,c])=>`<button class="${c}" onclick="addStat(${i},'${k}')"><strong>${p[k]}</strong><small>${sign} ${l}</small></button>`).join('')}</div></div>`).join('')}
    <button class="action-button full-button" onclick="finishMatch()">${m.editing?'SAČUVAJ IZMENE':'ZAVRŠI I SAČUVAJ UTAKMICU'}</button><button class="secondary-button full-button match-danger" onclick="cancelMatch()">${m.editing?'Odustani od izmena':'Otkaži započetu utakmicu'}</button>`;
    if(keepScroll)window.scrollTo(0,y);else window.scrollTo(0,0);
}
function setCorrection(v){correctionMode=v;showLiveMatch(true);}
function addStat(i,k){if(!['goals','penalties','exclusions','redCards'].includes(k))return;const delta=correctionMode?-1:1;if(!currentMatch.players[i]||currentMatch.players[i][k]+delta<0)return;mutateMatch(m=>{m.history=m.history||[];m.players[i][k]+=delta;m.history.push({kind:'player',index:i,type:k,delta});});}
function opponentGoal(delta){if(currentMatch.opponentGoals+delta<0)return;mutateMatch(m=>{m.history=m.history||[];m.opponentGoals+=delta;m.history.push({kind:'opponent',change:delta});});}
function selectMVP(i){mutateMatch(m=>{m.history=m.history||[];m.history.push({kind:'mvp',previous:m.mvp});m.mvp=m.mvp===m.players[i].id?null:m.players[i].id;});}
function recordHalfTime(){
    let own=getMatchGoals(currentMatch),opp=currentMatch.opponentGoals;
    if(currentMatch.halfTime||currentMatch.editing){
        const a=prompt('Golovi Obilića na poluvremenu:',currentMatch.halfTime?.own??own);if(a===null)return;
        const b=prompt('Golovi protivnika na poluvremenu:',currentMatch.halfTime?.opponent??opp);if(b===null)return;
        if(!/^\d+$/.test(a.trim())||!/^\d+$/.test(b.trim())){alert('Unesi nenegativne cele brojeve.');return;}own=Number(a);opp=Number(b);
    }else if(!confirm('Zabeleži poluvreme '+own+':'+opp+'?'))return;
    if(own>getMatchGoals(currentMatch)||opp>currentMatch.opponentGoals){alert('Rezultat na poluvremenu ne može biti veći od trenutnog rezultata.');return;}
    mutateMatch(m=>{m.history=m.history||[];m.history.push({kind:'half',previous:m.halfTime||null});m.halfTime={own,opponent:opp};});
}
function undoLastStat(){if(!currentMatch.history?.length){alert('Nema unosa za poništavanje.');return;}mutateMatch(m=>{const l=m.history.pop();if(l.kind==='player')m.players[l.index][l.type]-=(l.delta??1);else if(l.kind==='opponent')m.opponentGoals-=l.change;else if(l.kind==='mvp')m.mvp=l.previous;else if(l.kind==='half')m.halfTime=l.previous;});}
function finishMatch(){
    const m=currentMatch;if(!m)return;
    if(m.halfTime&&(m.halfTime.own>getMatchGoals(m)||m.halfTime.opponent>m.opponentGoals)){alert('Ispravi rezultat na poluvremenu pre čuvanja.');return;}
    if(!m.halfTime&&!confirm('Poluvreme nije zabeleženo. Nastaviti?'))return;
    if(!m.mvp&&!confirm('MVP nije izabran. Nastaviti?'))return;
    if(!confirm('Sačuvati rezultat Obilić '+getMatchGoals(m)+':'+m.opponentGoals+' '+m.opponent+'?'))return;
    try{const d=Database.load();const finished=matchClone(m);delete finished.editing;finished.finished=true;d.matches=d.matches.filter(x=>x.id!==m.id);d.matches.push(finished);d.draftMatch=null;Database.save(d);currentMatch=null;correctionMode=false;showMatches();}
    catch(e){alert('Utakmica nije sačuvana: '+e.message);}
}
function cancelMatch(){if(!confirm(currentMatch.editing?'Odbaciti izmene? Originalna utakmica ostaje sačuvana.':'Otkazati utakmicu i obrisati sve njene nezavršene unose?'))return;if(storeDraft(null)){correctionMode=false;showHome();}}
function editMatch(id){if(currentMatch){alert('Prvo završi ili otkaži otvorenu utakmicu.');return;}const m=Database.load().matches.find(x=>x.id===id);if(!m)return;const draft=matchClone(m);draft.editing=true;draft.history=[];correctionMode=false;if(storeDraft(draft))showLiveMatch();}
function deleteMatch(id){if(currentMatch?.id===id){alert('Prvo zatvori izmenu utakmice.');return;}if(!confirm('Trajno obrisati ovu utakmicu i njenu statistiku?'))return;try{const d=Database.load();d.matches=d.matches.filter(x=>x.id!==id);Database.save(d);showMatches();}catch(e){alert('Brisanje nije uspelo: '+e.message);}}
function matchScore(m,half=false){const a=half?m.halfTime?.own:getMatchGoals(m);const b=half?m.halfTime?.opponent:m.opponentGoals;return a==null||b==null?'—':m.venue==='away'?b+':'+a:a+':'+b;}
function matchTitle(m){return m.venue==='away'?escapeHTML(m.opponent)+' - Obilić':'Obilić - '+escapeHTML(m.opponent);}
function showMatches(){const d=Database.load();const matches=d.matches.filter(m=>m.season===d.activeSeason).sort((a,b)=>b.date.localeCompare(a.date));main.innerHTML=`<div class="module-toolbar"><button class="secondary-button" onclick="showHome()">← Početna</button></div><h2>Odigrane utakmice</h2>${matches.length?'':'<div class="empty-state">Nema sačuvanih utakmica.</div>'}${matches.map(m=>`<div class="player-row"><div class="player-info"><div class="player-details">${escapeHTML(m.date)} | ${escapeHTML(m.round)}. kolo | ${escapeHTML(m.competition)}</div><div class="player-name">${matchTitle(m)}</div><div class="player-details">Poluvreme: ${matchScore(m,true)}</div></div><h2>${matchScore(m)}</h2><button class="secondary-button" data-id="${escapeHTML(m.id)}" onclick="showMatchDetails(this.dataset.id)">Detalji</button></div>`).join('')}`;}
function showMatchDetails(id){const m=Database.load().matches.find(x=>x.id===id);if(!m)return;main.innerHTML=`<button class="secondary-button" onclick="showMatches()">← Utakmice</button><h2>${matchTitle(m)}</h2><h2>${matchScore(m)}</h2><p>Poluvreme: ${matchScore(m,true)}</p><div class="match-tools"><button class="action-button" data-id="${escapeHTML(id)}" onclick="editMatch(this.dataset.id)">Izmeni statistiku</button><button class="secondary-button match-danger" data-id="${escapeHTML(id)}" onclick="deleteMatch(this.dataset.id)">Obriši utakmicu</button></div><div class="form-panel"><div class="table-scroll"><table class="stats-table"><thead><tr><th>Br.</th><th>Igrač</th><th>G</th><th>7m</th><th>2′</th><th>CK</th><th>MVP</th></tr></thead><tbody>${m.players.map(p=>`<tr><td>${escapeHTML(p.number)}</td><td>${escapeHTML(p.firstName)} ${escapeHTML(p.lastName)}</td><td>${p.goals+p.penalties}</td><td>${p.penalties}</td><td>${p.exclusions}</td><td>${p.redCards}</td><td>${m.mvp===p.id?'🏆':''}</td></tr>`).join('')}</tbody></table></div></div>`;}
function showSeasonStatistics(){const d=Database.load();const all=d.matches.filter(m=>m.season===d.activeSeason);const competitions=[...new Set(['Super B liga','Kup Srbije','Prijateljska utakmica','Ostalo',...all.map(m=>m.competition)])];const matches=all.filter(m=>competitionFilter==='all'||m.competition===competitionFilter);const totals=new Map();const empty=p=>({name:p.firstName+' '+p.lastName,appearances:0,goals:0,penalties:0,exclusions:0,redCards:0,mvp:0});seasonPlayers().forEach(p=>totals.set(p.id,empty(p)));matches.forEach(m=>m.players.forEach(p=>{if(!totals.has(p.id))totals.set(p.id,empty(p));const t=totals.get(p.id);t.appearances++;t.goals+=p.goals+p.penalties;t.penalties+=p.penalties;t.exclusions+=p.exclusions;t.redCards+=p.redCards;if(m.mvp===p.id)t.mvp++;}));const rows=[...totals.values()].sort((a,b)=>b.goals-a.goals);main.innerHTML=`<button class="secondary-button" onclick="showHome()">← Početna</button><h2>Statistika sezone</h2><p>${escapeHTML(d.activeSeason)} | Utakmice: ${matches.length}</p><div class="form-field match-filter"><label>Takmičenje</label><select onchange="competitionFilter=this.value;showSeasonStatistics()"><option value="all">Sva takmičenja</option>${competitions.map(c=>`<option value="${escapeHTML(c)}" ${competitionFilter===c?'selected':''}>${escapeHTML(c)}</option>`).join('')}</select></div><div class="form-panel"><div class="table-scroll"><table class="stats-table"><thead><tr><th>Igrač</th><th>U</th><th>G</th><th>7m</th><th>2′</th><th>CK</th><th>MVP</th><th>Prosek</th></tr></thead><tbody>${rows.map(p=>`<tr><td>${escapeHTML(p.name)}</td><td>${p.appearances}</td><td><strong>${p.goals}</strong></td><td>${p.penalties}</td><td>${p.exclusions}</td><td>${p.redCards}</td><td>${p.mvp}</td><td>${p.appearances?(p.goals/p.appearances).toFixed(2):'0.00'}</td></tr>`).join('')}</tbody></table></div></div>`;}
const previousOpenSection=openSection;
openSection=function(section){if(section==='Nova utakmica')showNewMatch();else if(section==='Utakmice')showMatches();else if(section==='Statistika')showSeasonStatistics();else previousOpenSection(section);};
const previousShowHome=showHome;
showHome=function(){previousShowHome();const d=Database.load();const matches=d.matches.filter(m=>m.season===d.activeSeason);const cards=main.querySelectorAll('.card strong');cards[1].textContent=matches.length;cards[2].textContent=matches.reduce((s,m)=>s+getMatchGoals(m),0);if(currentMatch){const b=main.querySelector('.primary h2');if(b)b.textContent=currentMatch.editing?'Nastavi izmenu utakmice':'Nastavi utakmicu';}};
showHome();
