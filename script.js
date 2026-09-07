const $=s=>document.querySelector(s); const app=$('#app'); let token=localStorage.getItem('mk_token'), me=JSON.parse(localStorage.getItem('mk_user')||'null');
const t={en:{reg:'Register for OPD',queue:'Check My Queue',regdesk:'Registration Desk',doctor:'Doctor Login',about:'About MediKiosk',help:'Help'},hi:{reg:'OPD के लिए पंजीकरण',queue:'मेरी कतार देखें',regdesk:'पंजीकरण डेस्क',doctor:'डॉक्टर लॉगिन',about:'MediKiosk के बारे में',help:'मदद'},mr:{reg:'OPD नोंदणी',queue:'माझी रांग पहा',regdesk:'नोंदणी डेस्क',doctor:'डॉक्टर लॉगिन',about:'MediKiosk बद्दल',help:'मदत'}};
function toast(x){const e=$('#toast');e.textContent=x;e.className='show';setTimeout(()=>e.className='',2500)}
async function api(url,opt={}){opt.headers=opt.headers||{};if(token)opt.headers.Authorization='Bearer '+token;const r=await fetch('/api'+url,opt);const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Request failed');return d}
function home(){app.innerHTML=`<div class="wrap"><section class="hero"><h1>MediKiosk</h1><p>Simple OPD registration and queue tracking for patients, registration staff and doctors.</p><div class="actions"><button onclick="registerPage()">${t[$('#lang').value].reg}</button><button class="secondary" onclick="queuePage()">${t[$('#lang').value].queue}</button></div></section><div class="grid"><div class="card imagecard" style="background-image:url('registration.jpg')"><h3>${t[$('#lang').value].regdesk}</h3></div><div class="card imagecard" style="background-image:url('queue.jpg')"><h3>${t[$('#lang').value].queue}</h3></div><div class="card imagecard" style="background-image:url('doctor.jpg')"><h3>${t[$('#lang').value].doctor}</h3></div></div><div class="credit">Group — Just vibing</div></div><button class="help" onclick="help()">?</button>`}
async function registerPage(){window.mkAdaptive=null;let ds=await api('/departments');app.innerHTML=`<div class="wrap"><div class="card form"><h2>${t[$('#lang').value].reg}</h2><div class="notice">Contact number must be exactly 10 digits. Email is optional.</div><div class="field"><label>Name *</label><input id="name" required></div><div class="field"><label>Contact *</label><input id="contact" type="tel" inputmode="numeric" maxlength="10"></div><div class="field"><label>Email ID (Optional)</label><input id="email" type="email" placeholder="example@email.com"></div><div class="field"><label>Preferred time</label><input id="time" type="time"></div><div class="field"><label>Department *</label><select id="dept"><option value="">Select department</option>${ds.map(x=>`<option>${x.name}</option>`).join('')}</select></div><div class="field"><label>Medical history (Optional)</label><textarea id="history"></textarea></div><div class="card" style="margin:18px 0;padding:16px"><h3>🩺 Current Health Issue</h3><p>Tell us the main problem you are visiting for. The next questions will change based on your answer.</p><div class="field"><label>Main/current problem *</label><input id="currentIssue" placeholder="e.g. headache, fever, stomach pain"></div><div class="actions"><button type="button" onclick="renderAdaptiveQuestions()">Continue with Questions</button></div><div id="adaptiveQuestions" style="display:none"></div><div id="adaptiveStatus" class="notice">Questions not completed yet.</div></div><div class="field"><label>Prescription / medicine images (Optional)</label><input id="files" type="file" accept="image/*,.pdf" multiple></div><div class="actions"><button onclick="submitPatient()">Get Queue Number</button><button class="secondary" onclick="home()">Home</button></div></div></div>`;$('#contact').oninput=()=>$('#contact').value=$('#contact').value.replace(/\D/g,'').slice(0,10)}
function cleanText(v){return typeof v==='string'?v.trim():''}
async function submitPatient(){
  if(!window.mkAdaptive || !window.mkAdaptive.questions || Object.keys(window.mkAdaptive.answers||{}).length!==window.mkAdaptive.questions.length){toast('Please complete the Current Health Issue questions first.');return}
  const fd=new FormData();
  const name=cleanText($('#name').value);
  const contact=cleanText($('#contact').value);
  const email=cleanText($('#email').value);
  const preferredTime=cleanText($('#time').value);
  const previousHistory=cleanText($('#history').value);
  const department=cleanText($('#dept').value);
  fd.append('name',name);
  fd.append('contact',contact);
  fd.append('email',email);
  fd.append('preferredTime',preferredTime);
  fd.append('history',previousHistory);
  fd.append('previousHistory',previousHistory);
  fd.append('department',department);
  fd.append('currentIssue',cleanText(window.mkAdaptive.currentIssue));
  fd.append('adaptiveQuestionnaire',JSON.stringify(window.mkAdaptive));
  fd.append('adaptiveSummary',adaptiveSummary());
  [...$('#files').files].forEach(f=>fd.append('documents',f));
  try{const r=await api('/patients',{method:'POST',body:fd});localStorage.setItem('mk_last_queue',r.queueNo);queueResult(r.queueNo)}catch(e){toast(e.message)}
}
function queuePage(){app.innerHTML=`<div class="wrap"><div class="card form"><h2>${t[$('#lang').value].queue}</h2><div class="field"><label>Queue number</label><input id="q" placeholder="OPD-001"></div><div class="actions"><button onclick="queueResult($('#q').value.trim())">Check</button><button class="secondary" onclick="home()">Home</button></div></div></div>`}
async function queueResult(q){if(!q)return;try{const d=await api('/queue/'+encodeURIComponent(q));app.innerHTML=`<div class="wrap"><div class="card form"><p class="muted">${d.department}</p><div class="queueNo">${d.queueNo}</div><h2>${d.name}</h2><p>Status: <span class="pill">${d.status}</span></p><p><b>${d.ahead}</b> patient(s) ahead</p><p>Estimated wait: about <b>${d.estimatedMinutes} minutes</b></p><button onclick="queueResult('${d.queueNo}')">Refresh</button> <button class="secondary" onclick="home()">Home</button></div></div>`}catch(e){toast(e.message)}}
function login(kind){const bg=kind==='registration'?'regbg':'docbg';app.innerHTML=`<div class="wrap"><div class="loginbg ${bg}"><div class="card loginbox"><h2>${kind==='registration'?'Registration Desk Login':'Doctor Login'}</h2><div class="field"><label>Username</label><input id="u"></div><div class="field"><label>Password</label><input id="p" type="password"></div><div class="actions"><button onclick="doLogin('${kind}')">Login</button><button class="secondary" onclick="home()">Home</button></div><p class="small muted">Demo accounts: registration: regdesk / reg123. Doctors: bones, brain, opd, emergency, pediatrics / doc123</p></div></div></div>`}
async function doLogin(kind){try{const d=await api('/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:$('#u').value,password:$('#p').value})});if((kind==='registration'&&d.user.role!=='registration')||(kind==='doctor'&&d.user.role!=='doctor'))throw Error('Wrong dashboard for this account');token=d.token;me=d.user;localStorage.setItem('mk_token',token);localStorage.setItem('mk_user',JSON.stringify(me));kind==='registration'?regDash():docDash()}catch(e){toast(e.message)}}
async function regDash(){try{const rows=await api('/registration/queue');app.innerHTML=`<div class="wrap"><div class="card"><h2>Registration Desk</h2><p class="muted">Registration staff can enqueue patients and see only basic queue details.</p><div class="tablewrap"><table><tr><th>Queue</th><th>Name</th><th>Contact</th><th>Department</th><th>Status</th></tr>${rows.map(r=>`<tr><td>${r.queue_no}</td><td>${r.name}</td><td>${r.contact}</td><td>${r.department}</td><td>${r.status}</td></tr>`).join('')}</table></div><div class="actions"><button onclick="regDash()">Refresh</button><button class="secondary" onclick="logout()">Logout</button></div></div></div>`}catch(e){logout();toast(e.message)}}
async function docDash(){try{const rows=await api('/doctors/me/patients');const fs=await api('/doctors/me/followups');app.innerHTML=`<div class="wrap"><div class="card"><h2>${me.name}</h2><p class="muted">${me.department}</p><h3>Assigned Patients</h3><div class="tablewrap"><table><tr><th>Queue</th><th>Patient</th><th>Status</th><th>Action</th></tr>${rows.map(r=>`<tr><td>${r.queue_no}</td><td>${r.name}</td><td>${r.status}</td><td><button onclick="patient('${r.patient_id}')">Open File</button> <button onclick="callP(${r.id})">Call</button> <button onclick="completeP(${r.id})">Complete</button></td></tr>`).join('')}</table></div><h3>Upcoming Follow-ups</h3>${fs.map(f=>`<div class="notice"><b>${f.patient_name}</b> — ${new Date(f.followup_at).toLocaleString()} — ${f.mode}${f.meeting_link?`<br><a href="${f.meeting_link}" target="_blank">${f.meeting_link}</a>`:''}</div>`).join('')||'<p class="muted">No scheduled follow-ups.</p>'}<div class="actions"><button onclick="docDash()">Refresh</button><button class="secondary" onclick="logout()">Logout</button></div></div></div>`}catch(e){logout();toast(e.message)}}
async function patient(id){
  try{
    const p=await api('/doctors/me/patient/'+id);
    const savedAI = p.ai_summary ? (()=>{try{return JSON.parse(p.ai_summary)}catch(_){return null}})() : null;
    app.innerHTML=`<div class="wrap"><div class="card">
      <button class="secondary" onclick="docDash()">← Back</button>
      <h2>${escapeHtml(p.name)}</h2>
      <p><b>Contact:</b> ${escapeHtml(p.contact)}<br><b>Email:</b> ${escapeHtml(p.email||'Not provided')}<br><b>Department:</b> ${escapeHtml(p.department)}</p>

      <h3>Medical History</h3>
      <p>${escapeHtml(p.history||'Not provided')}</p>

      <h3>Current Issue</h3>
      <p>${escapeHtml(p.current_issue||'Not provided')}</p>

      <h3>AI Doctor Summary</h3>
      <div id="aiSummaryBox" class="notice">${savedAI ? formatAISummary(savedAI) : 'Generating summary from the patient-provided history and questionnaire...'}</div>
      <div class="actions">
        <button type="button" onclick="generateAISummary(${p.id})">Generate / Refresh AI Summary</button>
      </div>

      <h3>Documents</h3>
      ${p.documents.map(d=>`<div class="actions" style="margin:8px 0">
        <button type="button" class="secondary" onclick="openDoctorDocument(${d.id})">Open ${escapeHtml(d.original_name)}</button>
      </div>`).join('')||'<p class="muted">No documents uploaded.</p>'}

      <h3>Follow-up</h3>
      <div class="grid">
        <div class="field"><label>Date & time</label><input id="fu" type="datetime-local"></div>
        <div class="field"><label>Mode</label><select id="mode"><option>In-person</option><option>Online</option></select></div>
        <div class="field"><label>Reminder</label><select id="rem"><option value="15">15 min</option><option value="30" selected>30 min</option><option value="60">60 min</option></select></div>
      </div>
      <button onclick="follow(${p.id})">Schedule Follow-up</button>
    </div></div>`;

    if(!savedAI) generateAISummary(p.id);
  }catch(e){toast(e.message)}
}

function escapeHtml(v){
  return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function formatAISummary(s){
  const labels={
    chiefComplaint:'Chief complaint',
    historySummary:'History summary',
    relevantSymptoms:'Relevant symptoms',
    durationAndPattern:'Duration / pattern',
    severityAndImpact:'Severity / impact',
    relevantHistory:'Relevant history',
    medicationsOrAllergies:'Medications / allergies',
    redFlagsReported:'Reported red flags',
    missingImportantInformation:'Missing information',
    doctorHandoff:'Doctor handoff'
  };
  return Object.entries(labels).map(([k,label])=>{
    const v=s?.[k];
    return `<p><b>${label}:</b> ${escapeHtml(v||'Not provided')}</p>`;
  }).join('');
}

async function generateAISummary(id){
  const box=$('#aiSummaryBox');
  if(box) box.innerHTML='Generating summary...';
  try{
    const d=await api('/doctors/patient/'+id+'/ai-summary',{method:'POST'});
    if(box){
      box.innerHTML=(d.fallback?'⚠️ AI API is not configured. Showing a patient-information summary.<br><br>':'✓ AI summary<br><br>')+formatAISummary(d.summary);
    }
  }catch(e){
    if(box) box.innerHTML='Could not generate AI summary: '+escapeHtml(e.message);
    toast(e.message);
  }
}

async function openDoctorDocument(id){
  try{
    const r=await fetch('/api/doctors/documents/'+encodeURIComponent(id),{
      headers:{Authorization:'Bearer '+token}
    });
    if(!r.ok){
      const d=await r.json().catch(()=>({}));
      throw Error(d.error||'Could not open document');
    }
    const blob=await r.blob();
    const url=URL.createObjectURL(blob);
    const w=window.open(url,'_blank');
    if(!w){
      const a=document.createElement('a');
      a.href=url;
      a.download='document';
      a.click();
    }
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }catch(e){toast(e.message)}
}

async function follow(id){try{const d=await api('/doctors/followups',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({patientId:id,followupAt:$('#fu').value,mode:$('#mode').value,reminderMinutes:$('#rem').value})});toast(d.meetingLink?'Online follow-up scheduled':'Follow-up scheduled');docDash()}catch(e){toast(e.message)}}
async function callP(id){try{await api('/doctors/queue/'+id+'/call',{method:'POST'});docDash()}catch(e){toast(e.message)}}async function completeP(id){try{await api('/doctors/queue/'+id+'/complete',{method:'POST'});docDash()}catch(e){toast(e.message)}}
function logout(){token=null;me=null;localStorage.removeItem('mk_token');localStorage.removeItem('mk_user');home()}
function help(){app.insertAdjacentHTML('beforeend',`<div class="modal" onclick="this.remove()"><div class="card" onclick="event.stopPropagation()"><button class="close" onclick="this.parentElement.parentElement.remove()">Close</button><h2>How to Register</h2><ol><li>Enter your name and 10-digit contact number.</li><li>Email is optional; if entered, use a valid email.</li><li>Select your OPD department.</li><li>Add medical history or prescription images only if you want to.</li><li>Submit and keep your queue number.</li><li>Use Check My Queue to see patients ahead of you.</li></ol></div></div>`)}
function about(){app.insertAdjacentHTML('beforeend',`<div class="modal" onclick="this.remove()"><div class="card" onclick="event.stopPropagation()"><button class="close" onclick="this.parentElement.parentElement.remove()">Close</button><h2>About MediKiosk</h2><p>Hospital OPD queue and patient information management prototype.</p><h3>Group</h3><p><b>Just vibing</b></p></div></div>`)}
// ---------- Adaptive current-issue questionnaire ----------
const adaptiveFlows={
  headache:[['Where is the pain?','text'],['When did it start?','text'],['How severe is it (0-10)?','number'],['Is it continuous or does it come and go?','choice',['Continuous','Comes and goes']],['What makes it better or worse?','text'],['Any nausea, vomiting, dizziness, or vision changes?','text']],
  fever:[['When did the fever start?','text'],['What is the highest temperature you measured?','text'],['Do you have chills or sweating?','choice',['Yes','No']],['Any cough, sore throat, body pain, or weakness?','text'],['Has the fever improved, worsened, or stayed the same?','choice',['Improved','Worsened','Same']]],
  stomach:[['Where exactly is the stomach pain?','text'],['When did it start?','text'],['How severe is it (0-10)?','number'],['Is it constant or comes and goes?','choice',['Constant','Comes and goes']],['Any vomiting, diarrhoea, constipation, or bloating?','text'],['Does food make it better or worse?','text']],
  breathing:[['When did the breathing problem start?','text'],['Does it happen at rest, during activity, or both?','choice',['At rest','During activity','Both']],['How severe is it (0-10)?','number'],['Any cough, wheezing, chest tightness, or fever?','text'],['Has it suddenly become worse?','choice',['Yes','No']]],
  injury:[['What happened and when?','text'],['Where is the injury/pain?','text'],['How severe is it (0-10)?','number'],['Is there swelling, bleeding, bruising, or difficulty moving?','text'],['Did you lose consciousness or hit your head?','choice',['Yes','No']],['Has it improved, worsened, or stayed the same?','choice',['Improved','Worsened','Same']]],
  pain:[['Where is the pain?','text'],['When did it start?','text'],['How severe is it (0-10)?','number'],['Is it constant or comes and goes?','choice',['Constant','Comes and goes']],['What makes it better or worse?','text'],['Any other symptoms you noticed?','text']],
  general:[['When did this problem start?','text'],['How severe or troublesome is it (0-10)?','number'],['Has it improved, worsened, or stayed the same?','choice',['Improved','Worsened','Same']],['What makes it better or worse?','text'],['What other symptoms have you noticed?','text']]
};
function classifyIssue(v){v=(v||'').toLowerCase();if(/headache|migraine|head pain|head/.test(v))return'headache';if(/fever|temperature|chills/.test(v))return'fever';if(/stomach|abdomen|abdominal|tummy|belly|gastric/.test(v))return'stomach';if(/breath|breathing|shortness|asthma|wheez/.test(v))return'breathing';if(/injury|injured|fall|fell|accident|sprain|fracture|wound|hit/.test(v))return'injury';if(/pain|ache|hurt|sore|cramp/.test(v))return'pain';return'general'}
function renderAdaptiveQuestions(){
  const issue=($('#currentIssue')?.value||'').trim();
  if(!issue){toast('Please enter your main/current problem first.');$('#currentIssue')?.focus();return}
  const type=classifyIssue(issue); const qs=adaptiveFlows[type]||adaptiveFlows.general;
  window.mkAdaptive={currentIssue:issue,type,answers:{},questions:qs,index:0};
  const box=$('#adaptiveQuestions'); if(!box)return;
  box.style.display='block'; renderAdaptiveStep();
}
function renderAdaptiveStep(){
  const a=window.mkAdaptive;if(!a)return;const box=$('#adaptiveQuestions');const q=a.questions[a.index];
  const old=a.answers[a.index]??'';let input='';
  if(q[1]==='choice') input='<select id="adaptiveAnswer"><option value="">Select</option>'+q[2].map(x=>`<option ${old===x?'selected':''}>${x}</option>`).join('')+'</select>';
  else input=`<input id="adaptiveAnswer" type="${q[1]}" ${q[1]==='number'?'min="0" max="10"':''} value="${String(old).replace(/&/g,'&amp;').replace(/"/g,'&quot;')}" placeholder="Your answer">`;
  box.innerHTML=`<div class="field"><label>Question ${a.index+1} of ${a.questions.length}</label><p><b>${q[0]}</b></p>${input}</div><div class="actions">${a.index?'<button type="button" class="secondary" onclick="adaptiveBack()">Back</button>':''}<button type="button" onclick="adaptiveNext()">${a.index===a.questions.length-1?'Finish':'Next'}</button></div>`;
  $('#adaptiveAnswer')?.focus();
}
function adaptiveNext(){const a=window.mkAdaptive;if(!a)return;const el=$('#adaptiveAnswer');if(!el)return;const v=el.value.trim();if(!v){toast('Please answer this question to continue.');return}if(el.type==='number'&&(Number(v)<0||Number(v)>10)){toast('Please enter a value from 0 to 10.');return}a.answers[a.index]=v;if(a.index<a.questions.length-1){a.index++;renderAdaptiveStep()}else{$('#adaptiveStatus').textContent='✓ Questions completed. Your answers will be included for the doctor.';toast('Questionnaire completed');}}
function adaptiveBack(){const a=window.mkAdaptive;if(!a||a.index===0)return;const el=$('#adaptiveAnswer');if(el)a.answers[a.index]=el.value.trim();a.index--;renderAdaptiveStep()}
function adaptiveSummary(){const a=window.mkAdaptive;if(!a)return'';return a.questions.map((q,i)=>`${q[0]}: ${a.answers[i]??'Not answered'}`).join(' | ')}

$('#lang').onchange=home;$('#menuBtn').onclick=()=>{app.insertAdjacentHTML('beforeend',`<div class="modal" onclick="this.remove()"><div class="card" onclick="event.stopPropagation()"><button class="close" onclick="this.parentElement.parentElement.remove()">Close</button><h2>Menu</h2><div class="actions"><button onclick="login('registration');this.parentElement.parentElement.parentElement.remove()">Registration Desk</button><button onclick="login('doctor');this.parentElement.parentElement.parentElement.remove()">Doctor Login</button><button class="secondary" onclick="about();this.parentElement.parentElement.parentElement.remove()">About</button></div></div></div>`) };
home();
