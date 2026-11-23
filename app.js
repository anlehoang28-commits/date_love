const DATA_KEY = 'our_love_data_v1';
const CFG_KEY = 'our_love_sync_cfg_v1';
const GIST_FILE = 'our-love-data.json';

const QUOTES = [
  'Mỗi ngày bên nhau là một điều đáng nhớ. ♥',
  'Chỉ cần đi cùng nhau, đi đâu cũng thành kỷ niệm đẹp.',
  'Cảm ơn vì đã luôn kiên nhẫn và dịu dàng với nhau.',
  'Thế giới ngoài kia rộng lớn, nhưng bình yên nhất vẫn là ở cạnh nhau.',
  'Giận hờn rồi cũng qua, chỉ có thương nhau là ở lại.'
];

const defaultData = {
  startDate: '2026-02-11',
  name1: 'Anh',
  name2: 'Em',
  avatar1: '',
  avatar2: '',
  wishes: [],
  memories: [],
  hurts: [],
  updatedAt: Date.now()
};

let appData = loadData();
let syncCfg = loadCfg();

function loadData() {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    return raw ? { ...defaultData, ...JSON.parse(raw) } : { ...defaultData };
  } catch {
    return { ...defaultData };
  }
}

function saveData() {
  appData.updatedAt = Date.now();
  localStorage.setItem(DATA_KEY, JSON.stringify(appData));
}

function loadCfg() {
  try {
    return JSON.parse(localStorage.getItem(CFG_KEY)) || { token: '', gistId: '', autoPull: false, theme: 'dark' };
  } catch {
    return { token: '', gistId: '', autoPull: false, theme: 'dark' };
  }
}

function saveCfg() {
  localStorage.setItem(CFG_KEY, JSON.stringify(syncCfg));
  updateSyncDot();
}

function esc(str) {
  return String(str || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function compressImage(file, maxSize, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > h && w > maxSize) {
          h = Math.round((h * maxSize) / w);
          w = maxSize;
        } else if (h >= w && h > maxSize) {
          w = Math.round((w * maxSize) / h);
          h = maxSize;
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderAvatarsAndNames() {
  const n1 = document.getElementById('name1Text');
  const n2 = document.getElementById('name2Text');
  if (n1) n1.textContent = appData.name1 || 'Anh';
  if (n2) n2.textContent = appData.name2 || 'Em';

  [1, 2].forEach(idx => {
    const img = document.getElementById(`avatar${idx}Img`);
    const ph = document.getElementById(`avatar${idx}Placeholder`);
    const src = appData[`avatar${idx}`];
    if (img && ph) {
      if (src) {
        img.src = src;
        img.hidden = false;
        ph.hidden = true;
      } else {
        img.hidden = true;
        ph.hidden = false;
      }
    }
  });
}

function updateTimer() {
  const dateStr = appData.startDate || '2026-02-11';
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3) return;
  const start = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0);
  const diff = Math.max(0, Date.now() - start.getTime());

  const totalSecs = Math.floor(diff / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  const dEl = document.getElementById('daysCount');
  const hEl = document.getElementById('hoursCount');
  const mEl = document.getElementById('minsCount');
  const sEl = document.getElementById('secsCount');
  if (dEl) dEl.textContent = days;
  if (hEl) hEl.textContent = String(hours).padStart(2, '0');
  if (mEl) mEl.textContent = String(mins).padStart(2, '0');
  if (sEl) sEl.textContent = String(secs).padStart(2, '0');

  const milestones = [100, 200, 365, 500, 730, 1000, 1500, 2000, 3650];
  const next = milestones.find(m => m > days) || (Math.floor(days / 100) + 1) * 100;
  const prev = milestones[milestones.indexOf(next) - 1] || 0;
  const pct = Math.min(100, Math.max(4, Math.round(((days - prev) / (next - prev)) * 100)));

  const mText = document.getElementById('milestoneText');
  const mBar = document.getElementById('milestoneBar');
  if (mText) mText.textContent = `Cột mốc tiếp theo: ${next} ngày (còn ${next - days} ngày)`;
  if (mBar) mBar.style.width = `${pct}%`;
}

function renderWishes() {
  const list = document.getElementById('wishesList');
  const filter = document.getElementById('wishFilter')?.value || 'all';
  if (!list) return;

  const items = appData.wishes.filter(w => {
    if (filter === 'done') return w.done;
    if (filter === 'anh_to_em') return w.direction === 'anh_to_em' && !w.done;
    if (filter === 'em_to_anh') return w.direction === 'em_to_anh' && !w.done;
    return true;
  });

  if (!items.length) {
    list.innerHTML = '<div class="empty-msg">Chưa có mong muốn nào ở mục này.</div>';
    return;
  }

  list.innerHTML = items.map(w => {
    const dirLabel = w.direction === 'anh_to_em'
      ? `${esc(appData.name1)} muốn ${esc(appData.name2)}`
      : `${esc(appData.name2)} muốn ${esc(appData.name1)}`;
    return `
      <div class="entry-card ${w.done ? 'done' : ''}">
        <div class="entry-top">
          <span class="badge">${dirLabel}</span>
          <span>${esc(w.priority)}</span>
        </div>
        <div class="entry-body">${esc(w.content)}</div>
        <div class="entry-actions">
          <button class="mini-btn ok" onclick="toggleWish('${w.id}')">${w.done ? '✓ Đã chiều ý' : 'Đánh dấu đã làm'}</button>
          <button class="mini-btn del" onclick="deleteWish('${w.id}')">Xóa</button>
        </div>
      </div>`;
  }).join('');
}

window.toggleWish = id => {
  const item = appData.wishes.find(w => w.id === id);
  if (item) {
    item.done = !item.done;
    saveData();
    renderWishes();
  }
};

window.deleteWish = id => {
  appData.wishes = appData.wishes.filter(w => w.id !== id);
  saveData();
  renderWishes();
};

function renderMemories() {
  const list = document.getElementById('memoriesList');
  if (!list) return;
  if (!appData.memories.length) {
    list.innerHTML = '<div class="empty-msg">Chưa có kỷ niệm nào được lưu.</div>';
    return;
  }
  const sorted = [...appData.memories].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  list.innerHTML = sorted.map(m => `
    <div class="entry-card">
      <div class="entry-top">
        <span class="badge">📅 ${esc(m.date)}</span>
        <span>${m.location ? '📍 ' + esc(m.location) : ''}</span>
      </div>
      <strong>${esc(m.title)}</strong>
      ${m.note ? `<div class="entry-body">${esc(m.note)}</div>` : ''}
      ${m.photo ? `<img class="entry-photo" src="${m.photo}" alt="Kỷ niệm" />` : ''}
      <div class="entry-actions">
        <button class="mini-btn del" onclick="deleteMemory('${m.id}')">Xóa</button>
      </div>
    </div>
  `).join('');
}

window.deleteMemory = id => {
  appData.memories = appData.memories.filter(m => m.id !== id);
  saveData();
  renderMemories();
};

function renderHurts() {
  const list = document.getElementById('hurtsList');
  if (!list) return;
  if (!appData.hurts.length) {
    list.innerHTML = '<div class="empty-msg">Chưa có tâm sự nào. Mong hai đứa luôn vui vẻ nhé!</div>';
    return;
  }
  list.innerHTML = appData.hurts.map(h => `
    <div class="entry-card ${h.healed ? 'done' : 'hurt-open'}">
      <div class="entry-top">
        <span class="badge">${esc(h.sender)} chia sẻ · ${esc(h.date)}</span>
        <span>${h.healed ? '💚 Đã làm hòa' : '💔 Chờ xoa dịu'}</span>
      </div>
      <div class="entry-body">${esc(h.content)}</div>
      ${h.heal ? `<div class="sub-desc">Mong muốn: ${esc(h.heal)}</div>` : ''}
      <div class="entry-actions">
        <button class="mini-btn ok" onclick="toggleHurt('${h.id}')">${h.healed ? '💚 Đã hiểu nhau hơn' : 'Đánh dấu đã làm hòa'}</button>
        <button class="mini-btn del" onclick="deleteHurt('${h.id}')">Xóa</button>
      </div>
    </div>
  `).join('');
}

window.toggleHurt = id => {
  const item = appData.hurts.find(h => h.id === id);
  if (item) {
    item.healed = !item.healed;
    saveData();
    renderHurts();
  }
};

window.deleteHurt = id => {
  appData.hurts = appData.hurts.filter(h => h.id !== id);
  saveData();
  renderHurts();
};

function renderAll() {
  renderAvatarsAndNames();
  const dateInput = document.getElementById('startDateInput');
  if (dateInput) dateInput.value = appData.startDate;
  updateTimer();
  renderWishes();
  renderMemories();
  renderHurts();
}

function updateSyncDot() {
  const dot = document.getElementById('syncDot');
  if (dot) dot.classList.toggle('online', Boolean(syncCfg.token && syncCfg.gistId));
}

function setSyncStatus(msg) {
  const el = document.getElementById('syncStatus');
  if (el) el.textContent = msg;
}

async function createGist() {
  const token = document.getElementById('gistToken').value.trim();
  if (!token) return setSyncStatus('⚠️ Bạn cần dán GitHub Token trước.');
  setSyncStatus('⏳ Đang tạo kho Cloud trên GitHub...');
  try {
    const res = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: 'Goc Nho Cua Hai Dua - Love Data',
        public: false,
        files: { [GIST_FILE]: { content: JSON.stringify(appData) } }
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    syncCfg.token = token;
    syncCfg.gistId = data.id;
    document.getElementById('gistId').value = data.id;
    saveCfg();
    setSyncStatus(`✅ Đã tạo kho Cloud thành công! Gist ID: ${data.id}`);
  } catch (err) {
    setSyncStatus(`❌ Lỗi tạo Gist (${err.message}). Kiểm tra lại quyền "gist" của Token.`);
  }
}

async function pushCloud() {
  const token = document.getElementById('gistToken').value.trim();
  const gistId = document.getElementById('gistId').value.trim().split('/').pop();
  if (!token || !gistId) return setSyncStatus('⚠️ Cần nhập đủ Token và Gist ID.');
  syncCfg.token = token;
  syncCfg.gistId = gistId;
  saveCfg();
  setSyncStatus('⏳ Đang đẩy dữ liệu lên Cloud...');
  try {
    const res = await fetch(`https://api.github.com/gists/${gistId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: { [GIST_FILE]: { content: JSON.stringify(appData) } } })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    setSyncStatus(`✅ Đã đẩy dữ liệu lên Cloud lúc ${new Date().toLocaleTimeString('vi-VN')}!`);
  } catch (err) {
    setSyncStatus(`❌ Lỗi đẩy dữ liệu (${err.message}).`);
  }
}

async function pullCloud(silent = false) {
  const token = (document.getElementById('gistToken')?.value || syncCfg.token || '').trim();
  const gistId = (document.getElementById('gistId')?.value || syncCfg.gistId || '').trim().split('/').pop();
  if (!token || !gistId) {
    if (!silent) setSyncStatus('⚠️ Cần nhập đủ Token và Gist ID.');
    return;
  }
  syncCfg.token = token;
  syncCfg.gistId = gistId;
  saveCfg();
  if (!silent) setSyncStatus('⏳ Đang tải dữ liệu từ Cloud...');
  try {
    const res = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const raw = data.files?.[GIST_FILE]?.content;
    if (!raw) throw new Error('Không thấy file dữ liệu trong Gist');
    appData = { ...defaultData, ...JSON.parse(raw) };
    localStorage.setItem(DATA_KEY, JSON.stringify(appData));
    renderAll();
    if (!silent) setSyncStatus(`✅ Đã đồng bộ dữ liệu mới nhất lúc ${new Date().toLocaleTimeString('vi-VN')}!`);
  } catch (err) {
    if (!silent) setSyncStatus(`❌ Lỗi tải dữ liệu (${err.message}).`);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (syncCfg.theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
  updateSyncDot();

  const today = new Date().toISOString().split('T')[0];
  if (document.getElementById('memoryDate')) document.getElementById('memoryDate').value = today;
  if (document.getElementById('hurtDate')) document.getElementById('hurtDate').value = today;

  const qEl = document.getElementById('dailyQuote');
  if (qEl) qEl.textContent = QUOTES[new Date().getDate() % QUOTES.length];

  renderAll();
  setInterval(updateTimer, 1000);

  // Navigation tabs
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab)?.classList.add('active');
    });
  });

  // Theme toggle
  document.getElementById('btnTheme')?.addEventListener('click', () => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    if (isLight) {
      document.documentElement.removeAttribute('data-theme');
      syncCfg.theme = 'dark';
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      syncCfg.theme = 'light';
    }
    saveCfg();
  });

  // Avatars & names
  [1, 2].forEach(idx => {
    document.getElementById(`avatar${idx}Box`)?.addEventListener('click', () => {
      document.getElementById(`avatar${idx}Input`)?.click();
    });
    document.getElementById(`avatar${idx}Input`)?.addEventListener('change', async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      appData[`avatar${idx}`] = await compressImage(file, 160, 0.7);
      saveData();
      renderAvatarsAndNames();
    });
    document.getElementById(`btnEditName${idx}`)?.addEventListener('click', () => {
      const nextName = prompt('Nhập biệt danh mới:', appData[`name${idx}`]);
      if (nextName && nextName.trim()) {
        appData[`name${idx}`] = nextName.trim();
        saveData();
        renderAvatarsAndNames();
      }
    });
  });

  // Start date
  document.getElementById('startDateInput')?.addEventListener('change', e => {
    if (e.target.value) {
      appData.startDate = e.target.value;
      saveData();
      updateTimer();
    }
  });

  // Wishes
  document.getElementById('wishForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const content = document.getElementById('wishContent').value.trim();
    if (!content) return;
    appData.wishes.unshift({
      id: String(Date.now()),
      direction: document.getElementById('wishDirection').value,
      content,
      priority: document.getElementById('wishPriority').value,
      done: false
    });
    document.getElementById('wishContent').value = '';
    saveData();
    renderWishes();
  });
  document.getElementById('wishFilter')?.addEventListener('change', renderWishes);

  // Memories
  let pendingPhoto = '';
  document.getElementById('memoryPhotoInput')?.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    pendingPhoto = await compressImage(file, 600, 0.65);
    document.getElementById('memoryPhotoLabel').textContent = `✅ Đã chọn ảnh: ${file.name}`;
  });
  document.getElementById('memoryForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const title = document.getElementById('memoryTitle').value.trim();
    if (!title) return;
    appData.memories.unshift({
      id: String(Date.now()),
      date: document.getElementById('memoryDate').value || today,
      location: document.getElementById('memoryLocation').value.trim(),
      title,
      note: document.getElementById('memoryNote').value.trim(),
      photo: pendingPhoto
    });
    pendingPhoto = '';
    document.getElementById('memoryTitle').value = '';
    document.getElementById('memoryLocation').value = '';
    document.getElementById('memoryNote').value = '';
    document.getElementById('memoryPhotoLabel').textContent = '🖼️ Chọn 1 ảnh kỷ niệm (tùy chọn)';
    saveData();
    renderMemories();
  });

  // Hurts
  document.getElementById('hurtForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const content = document.getElementById('hurtContent').value.trim();
    if (!content) return;
    appData.hurts.unshift({
      id: String(Date.now()),
      sender: document.getElementById('hurtSender').value,
      date: document.getElementById('hurtDate').value || today,
      content,
      heal: document.getElementById('hurtHeal').value.trim(),
      healed: false
    });
    document.getElementById('hurtContent').value = '';
    document.getElementById('hurtHeal').value = '';
    saveData();
    renderHurts();
  });

  // Cloud Sync Modal
  const modal = document.getElementById('syncModal');
  document.getElementById('btnOpenSync')?.addEventListener('click', () => {
    document.getElementById('gistToken').value = syncCfg.token || '';
    document.getElementById('gistId').value = syncCfg.gistId || '';
    document.getElementById('autoPullCheck').checked = Boolean(syncCfg.autoPull);
    modal.hidden = false;
  });
  document.getElementById('btnCloseSync')?.addEventListener('click', () => { modal.hidden = true; });
  modal?.addEventListener('click', e => { if (e.target === modal) modal.hidden = true; });

  document.getElementById('btnCreateGist')?.addEventListener('click', createGist);
  document.getElementById('btnPushCloud')?.addEventListener('click', pushCloud);
  document.getElementById('btnPullCloud')?.addEventListener('click', () => pullCloud(false));
  document.getElementById('autoPullCheck')?.addEventListener('change', e => {
    syncCfg.autoPull = e.target.checked;
    saveCfg();
  });

  document.getElementById('btnExportJson')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(appData, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'goc-nho-hai-dua.json';
    a.click();
    setSyncStatus('📥 Đã tải xuống file dự phòng goc-nho-hai-dua.json');
  });

  document.getElementById('btnImportJson')?.addEventListener('click', () => {
    document.getElementById('importFileInput')?.click();
  });
  document.getElementById('importFileInput')?.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        appData = { ...defaultData, ...JSON.parse(ev.target.result) };
        saveData();
        renderAll();
        setSyncStatus('✅ Đã khôi phục dữ liệu từ file .json!');
      } catch {
        setSyncStatus('❌ File .json không hợp lệ.');
      }
    };
    reader.readAsText(file);
  });

  if (syncCfg.autoPull && syncCfg.token && syncCfg.gistId) {
    pullCloud(true);
  }
});