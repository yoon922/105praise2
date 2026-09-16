// ===================== 기본 설정 =====================
const studentsCol = db.collection('students');
const praisesCol  = db.collection('praises');
const settingsRef = db.collection('settings').doc('main');

let currentUser = null;      // { name, role: 'student' | 'teacher' }
let currentRound = 1;
let classLabel = '1학년 5반'; // 반이 바뀌면 이 글자만 수정하면 돼요
let entriesState = { general: [], mentor: [] };

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];

// ===================== 초기화 =====================
init();

async function init() {
  const settingsSnap = await settingsRef.get();
  if (!settingsSnap.exists) {
    await settingsRef.set({ round: 1, classLabel });
    currentRound = 1;
  } else {
    currentRound = settingsSnap.data().round || 1;
  }
  $('#classLabel').textContent = classLabel;
  $('#roundNoWrite').textContent = currentRound + '회차';
  $('#roundNoTeacher').textContent = currentRound + '회차';

  const saved = localStorage.getItem('cp_session');
  if (saved) {
    currentUser = JSON.parse(saved);
    showView();
  }

  bindAuthForms();
  bindStudentView();
  bindTeacherView();
}

function showView() {
  $('#authView').classList.add('is-hidden');
  $('#studentView').classList.add('is-hidden');
  $('#teacherView').classList.add('is-hidden');

  if (!currentUser) {
    $('#authView').classList.remove('is-hidden');
    return;
  }
  if (currentUser.role === 'teacher') {
    $('#teacherView').classList.remove('is-hidden');
    loadTeacherDashboard();
  } else {
    $('#studentView').classList.remove('is-hidden');
    $('#studentGreeting').textContent = `${currentUser.name}님, 환영해요!`;
    renderEntries('general');
    renderEntries('mentor');
  }
}

function logout() {
  currentUser = null;
  localStorage.removeItem('cp_session');
  entriesState = { general: [], mentor: [] };
  showView();
}
$('#logoutBtn1').addEventListener('click', logout);
$('#logoutBtn2').addEventListener('click', logout);

// ===================== 로그인 / 회원가입 =====================
function bindAuthForms() {
  $$('.tab[data-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.tab[data-tab]').forEach(t => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      const target = tab.dataset.tab;
      $('#loginForm').classList.toggle('is-hidden', target !== 'login');
      $('#signupForm').classList.toggle('is-hidden', target !== 'signup');
    });
  });

  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    $('#loginError').textContent = '';
    const name = $('#loginName').value.trim();
    const pw = $('#loginPw').value;

    if (name === '선생님') {
      if (pw === TEACHER_PASSWORD) {
        currentUser = { name: '선생님', role: 'teacher' };
        localStorage.setItem('cp_session', JSON.stringify(currentUser));
        showView();
      } else {
        $('#loginError').textContent = '선생님 비밀번호가 올바르지 않아요.';
      }
      return;
    }

    const doc = await studentsCol.doc(name).get();
    if (!doc.exists || doc.data().password !== pw) {
      $('#loginError').textContent = '이름 또는 비밀번호가 올바르지 않아요.';
      return;
    }
    currentUser = { name, role: 'student' };
    localStorage.setItem('cp_session', JSON.stringify(currentUser));
    showView();
  });

  $('#signupForm').addEventListener('submit', async e => {
    e.preventDefault();
    $('#signupError').textContent = '';
    const name = $('#suName').value.trim();
    const sid = $('#suSid').value.trim();
    const pw = $('#suPw').value;
    const pw2 = $('#suPw2').value;

    if (name === '선생님') {
      $('#signupError').textContent = '"선생님"은 이름으로 사용할 수 없어요.';
      return;
    }
    if (pw.length < 4) {
      $('#signupError').textContent = '비밀번호는 4자리 이상이어야 해요.';
      return;
    }
    if (pw !== pw2) {
      $('#signupError').textContent = '비밀번호가 서로 달라요.';
      return;
    }
    const existing = await studentsCol.doc(name).get();
    if (existing.exists) {
      $('#signupError').textContent = '이미 등록된 이름이에요. 로그인해주세요.';
      return;
    }
    await studentsCol.doc(name).set({
      name, studentId: sid, password: pw,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    currentUser = { name, role: 'student' };
    localStorage.setItem('cp_session', JSON.stringify(currentUser));
    showView();
  });
}

// ===================== 학생: 칭찬 작성 =====================
function bindStudentView() {
  $$('.tab[data-stab]').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.tab[data-stab]').forEach(t => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      const target = tab.dataset.stab;
      $('#writeTab').classList.toggle('is-hidden', target !== 'write');
      $('#mineTab').classList.toggle('is-hidden', target !== 'mine');
      if (target === 'mine') loadMyRecords();
    });
  });

  $$('.toggle-example').forEach(btn => {
    btn.addEventListener('click', () => {
      const box = btn.closest('.category').querySelector('.example-box');
      box.classList.toggle('is-hidden');
    });
  });

  $$('.add-entry').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      if (entriesState[type].length >= 25) return;
      entriesState[type].push({ target: '', content: '' });
      renderEntries(type);
    });
  });

  $('#submitAllBtn').addEventListener('click', submitAllPraises);
}

function renderEntries(type) {
  const container = $(`#entries-${type}`);
  container.innerHTML = '';
  entriesState[type].forEach((entry, idx) => {
    const card = document.createElement('div');
    card.className = 'entry-card';

    const targetInput = document.createElement('input');
    targetInput.type = 'text';
    targetInput.placeholder = '누구에게 칭찬을 전할까요? (예: 김서준)';
    targetInput.value = entry.target;
    targetInput.addEventListener('input', () => entry.target = targetInput.value);

    const contentInput = document.createElement('textarea');
    contentInput.placeholder = '구체적인 칭찬 내용을 적어주세요.';
    contentInput.value = entry.content;
    contentInput.addEventListener('input', () => entry.content = contentInput.value);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-entry';
    removeBtn.textContent = '삭제';
    removeBtn.addEventListener('click', () => {
      entriesState[type].splice(idx, 1);
      renderEntries(type);
    });

    card.append(targetInput, contentInput, removeBtn);
    container.appendChild(card);
  });

  const countEl = $(`.add-entry[data-type="${type}"] .count`);
  if (countEl) countEl.textContent = entriesState[type].length;
}

async function submitAllPraises() {
  const msg = $('#submitMsg');
  const toSubmit = [];
  ['general', 'mentor'].forEach(type => {
    entriesState[type].forEach(entry => {
      if (entry.content.trim()) {
        toSubmit.push({
          type,
          target: entry.target.trim() || '전체',
          content: entry.content.trim(),
          authorName: currentUser.name,
          round: currentRound,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    });
  });

  if (toSubmit.length === 0) {
    msg.textContent = '작성한 칭찬이 없어요. 내용을 입력한 뒤 제출해주세요.';
    return;
  }

  msg.textContent = '제출 중...';
  const batch = db.batch();
  toSubmit.forEach(item => batch.set(praisesCol.doc(), item));
  await batch.commit();

  entriesState = { general: [], mentor: [] };
  renderEntries('general');
  renderEntries('mentor');
  msg.textContent = `칭찬 ${toSubmit.length}개를 제출했어요. 고마워요! 🌟`;
}

async function loadMyRecords() {
  const list = $('#mineList');
  list.innerHTML = '불러오는 중...';
  const snap = await praisesCol
    .where('authorName', '==', currentUser.name)
    .where('round', '==', currentRound)
    .get();

  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (items.length === 0) {
    list.innerHTML = '<p class="hint">이번 회차에 작성한 칭찬이 아직 없어요.</p>';
    return;
  }
  list.innerHTML = '';
  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'mine-item';
    list.appendChild(div);
    renderMineItem(item, div);
  });
}

function renderMineItem(item, div) {
  div.innerHTML = '';

  const tag = document.createElement('div');
  tag.className = 'tag';
  tag.textContent = (item.type === 'general' ? '💬 일반 칭찬' : '🤝 멘토·멘티') + ' → ' + item.target;

  const body = document.createElement('div');
  body.textContent = item.content;

  const actions = document.createElement('div');
  actions.className = 'row-actions';
  const editBtn = document.createElement('button');
  editBtn.className = 'btn btn-outline btn-sm';
  editBtn.textContent = '✏️ 수정';
  editBtn.addEventListener('click', () => renderMineItemEdit(item, div));

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn-ghost btn-sm';
  deleteBtn.textContent = '🗑️ 삭제';
  deleteBtn.addEventListener('click', async () => {
    if (!confirm('이 칭찬을 삭제할까요? 되돌릴 수 없어요.')) return;
    await praisesCol.doc(item.id).delete();
    const list = div.parentElement;
    div.remove();
    if (list && list.children.length === 0) {
      list.innerHTML = '<p class="hint">이번 회차에 작성한 칭찬이 아직 없어요.</p>';
    }
  });

  actions.append(editBtn, deleteBtn);
  div.append(tag, body, actions);
}

function renderMineItemEdit(item, div) {
  div.innerHTML = '';

  const targetInput = document.createElement('input');
  targetInput.type = 'text';
  targetInput.value = item.target;

  const contentInput = document.createElement('textarea');
  contentInput.value = item.content;

  const actions = document.createElement('div');
  actions.className = 'row-actions';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn btn-primary btn-sm';
  saveBtn.textContent = '저장';
  saveBtn.addEventListener('click', async () => {
    const newTarget = targetInput.value.trim() || '전체';
    const newContent = contentInput.value.trim();
    if (!newContent) { alert('내용을 입력해주세요.'); return; }
    await praisesCol.doc(item.id).update({ target: newTarget, content: newContent });
    item.target = newTarget;
    item.content = newContent;
    renderMineItem(item, div);
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-ghost btn-sm';
  cancelBtn.textContent = '취소';
  cancelBtn.addEventListener('click', () => renderMineItem(item, div));

  actions.append(saveBtn, cancelBtn);
  div.append(targetInput, contentInput, actions);
}

// ===================== 선생님: 대시보드 =====================
function bindTeacherView() {
  $$('.tab[data-ttab]').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.tab[data-ttab]').forEach(t => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      const target = tab.dataset.ttab;
      $('#listTab').classList.toggle('is-hidden', target !== 'list');
      $('#membersTab').classList.toggle('is-hidden', target !== 'members');
      if (target === 'members') loadMembers();
    });
  });

  $('#typeFilter').addEventListener('change', loadTeacherDashboard);
  $('#exportPraiseBtn').addEventListener('click', exportPraisesToExcel);
  $('#exportMemberBtn').addEventListener('click', exportMembersToExcel);
  $('#newRoundBtn').addEventListener('click', startNewRound);
}

let cachedPraises = [];

async function loadTeacherDashboard() {
  $('#roundNoTeacher').textContent = currentRound + '회차';
  const snap = await praisesCol.where('round', '==', currentRound).get();
  cachedPraises = snap.docs.map(d => d.data());

  const authors = new Set(cachedPraises.map(p => p.authorName));
  $('#statTotal').textContent = cachedPraises.length;
  $('#statStudents').textContent = authors.size;
  $('#statMentor').textContent = cachedPraises.filter(p => p.type === 'mentor').length;
  $('#statGeneral').textContent = cachedPraises.filter(p => p.type === 'general').length;

  renderPraiseTable();
}

function renderPraiseTable() {
  const filter = $('#typeFilter').value;
  const table = $('#praiseTable');
  table.innerHTML = '';
  const rows = cachedPraises.filter(p => filter === 'all' || p.type === filter);

  if (rows.length === 0) {
    table.innerHTML = '<p class="hint">아직 등록된 칭찬이 없어요.</p>';
    return;
  }
  rows.forEach(p => {
    const row = document.createElement('div');
    row.className = 'row-card';
    const top = document.createElement('div');
    top.className = 'row-top';
    const left = document.createElement('span');
    left.textContent = `${p.authorName} → ${p.target}`;
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = p.type === 'general' ? '일반' : '멘토·멘티';
    top.append(left, badge);
    const body = document.createElement('div');
    body.textContent = p.content;
    row.append(top, body);
    table.appendChild(row);
  });
}

async function loadMembers() {
  const table = $('#memberTable');
  table.innerHTML = '불러오는 중...';
  const snap = await studentsCol.orderBy('name').get();

  if (snap.empty) {
    table.innerHTML = '<p class="hint">아직 가입한 학생이 없어요.</p>';
    return;
  }
  table.innerHTML = '';
  snap.forEach(doc => {
    const s = doc.data();
    const row = document.createElement('div');
    row.className = 'row-card';

    const top = document.createElement('div');
    top.className = 'row-top';
    const left = document.createElement('span');
    left.textContent = `${s.name} (학번 ${s.studentId})`;
    top.append(left);

    const pwLine = document.createElement('div');
    pwLine.append('비밀번호: ');
    const pwSpan = document.createElement('span');
    pwSpan.className = 'pw';
    pwSpan.textContent = s.password;
    pwLine.appendChild(pwSpan);

    const actions = document.createElement('div');
    actions.className = 'row-actions';
    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn btn-outline btn-sm';
    resetBtn.textContent = '비밀번호 초기화 (0000)';
    resetBtn.addEventListener('click', async () => {
      if (!confirm(`${s.name} 학생의 비밀번호를 0000으로 초기화할까요?`)) return;
      await studentsCol.doc(doc.id).update({ password: '0000' });
      loadMembers();
    });
    actions.appendChild(resetBtn);

    row.append(top, pwLine, actions);
    table.appendChild(row);
  });
}

// ===================== 엑셀 내보내기 =====================
function exportPraisesToExcel() {
  if (cachedPraises.length === 0) {
    alert('내보낼 칭찬 기록이 없어요.');
    return;
  }
  const rows = cachedPraises.map(p => ({
    유형: p.type === 'general' ? '일반 칭찬' : '멘토·멘티',
    작성자: p.authorName,
    대상: p.target,
    내용: p.content,
    작성일시: formatTimestamp(p.createdAt)
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${currentRound}회차 칭찬`);
  XLSX.writeFile(wb, `칭찬합시다_${currentRound}회차.xlsx`);
}

function formatTimestamp(ts) {
  if (!ts || typeof ts.toDate !== 'function') return '-';
  return ts.toDate().toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
}

async function exportMembersToExcel() {
  const snap = await studentsCol.orderBy('name').get();
  const rows = snap.docs.map(d => {
    const s = d.data();
    return { 이름: s.name, 학번: s.studentId, 비밀번호: s.password };
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '학생 목록');
  XLSX.writeFile(wb, `칭찬합시다_학생목록.xlsx`);
}

// ===================== 새 회차 시작 (기록 초기화) =====================
async function startNewRound() {
  if (cachedPraises.length > 0) {
    const wantsExport = confirm(
      `현재 ${currentRound}회차 칭찬 ${cachedPraises.length}개를 삭제하고 새 회차를 시작합니다.\n` +
      `삭제 전에 엑셀로 먼저 백업할까요? (추천: 확인)`
    );
    if (wantsExport) exportPraisesToExcel();
  }

  const typed = prompt('정말 초기화하려면 "초기화"를 입력해주세요. (학생 계정은 삭제되지 않아요)');
  if (typed !== '초기화') {
    alert('취소되었어요.');
    return;
  }

  // 현재 회차 기록 삭제 (500개씩 나눠서 batch 삭제)
  const snap = await praisesCol.where('round', '==', currentRound).get();
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch();
    docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }

  currentRound += 1;
  await settingsRef.update({ round: currentRound });
  alert(`${currentRound}회차가 시작되었어요! 학생 계정과 비밀번호는 그대로 유지돼요.`);
  loadTeacherDashboard();
}
