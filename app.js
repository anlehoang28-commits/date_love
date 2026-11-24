const CLOUD_ENDPOINT = 'https://tu-vung-anle-default-rtdb.firebaseio.com/date_love/shared_data.json';
const DATA_KEY = 'our_love_data_v1';
const CFG_KEY = 'our_love_ui_cfg_v1';

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
  updatedAt: 0
};

let appData = loadData();
let uiCfg = loadCfg();
let autoPushTimer = null;
let isSyncing = false;

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
  clearTimeout(autoPushTimer);
  setSyncBadge('⏳ Đang lưu...');
  autoPushTimer = setTimeout(() => pushCloud(true), 800);
}

function loadCfg() {
  try {
    const cfg = JSON.parse(localStorage.getItem(CFG_KEY));
    return cfg ? { autoPull: true, theme: 'dark', ...cfg } : { autoPull: true, theme: 'dark' };
  } catch {
    return { autoPull: true, theme: 'dark' };
  }
}

function saveCfg() {
  localStorage.setItem(CFG_KEY, JSON.stringify(uiCfg));
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
        if (ctx) ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = String(e.target?.result || '');
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
  if (dEl) dEl.textContent = String(days);
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

  const items = (appData.wishes || []).filter(w => {
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
          <button type="button" class="mini-btn ok" data-action="toggle-wish" data-id="${esc(w.id)}">${w.done ? '✓ Đã chiều ý' : 'Đánh dấu đã làm'}</button>
          <button type="button" class="mini-btn del" data-action="del-wish" data-id="${esc(w.id)}">Xóa</button>
        </div>
      </div>`;
  }).join('');
}

function renderMemories() {
  const list = document.getElementById('memoriesList');
  if (!list) return;
  if (!(appData.memories || []).length) {
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
        <button type="button" class="mini-btn del" data-action="del-memory" data-id="${esc(m.id)}">Xóa</button>
      </div>
    </div>
  `).join('');
}

function renderHurts() {
  const list = document.getElementById('hurtsList');
  if (!list) return;
  if (!(appData.hurts || []).length) {
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
        <button type="button" class="mini-btn ok" data-action="toggle-hurt" data-id="${esc(h.id)}">${h.healed ? '💚 Đã hiểu nhau hơn' : 'Đánh dấu đã làm hòa'}</button>
        <button type="button" class="mini-btn del" data-action="del-hurt" data-id="${esc(h.id)}">Xóa</button>
      </div>
    </div>
  `).join('');
}

function renderAll() {
  renderAvatarsAndNames();
  const dateInput = document.getElementById('startDateInput');
  if (dateInput) dateInput.value = appData.startDate;
  updateTimer();
  renderWishes();
  renderMemories();
  renderHurts();
}

function setSyncStatus(msg) {
  const el = document.getElementById('syncStatus');
  if (el) el.textContent = msg;
}

function setSyncBadge(text) {
  const pill = document.querySelector('#btnOpenSync span:first-child');
  if (pill) pill.textContent = text;
}

async function pushCloud(silent = false) {
  if (isSyncing) return;
  isSyncing = true;
  if (!silent) setSyncStatus('⏳ Đang đẩy dữ liệu lên Cloud...');
  try {
    const res = await fetch(CLOUD_ENDPOINT, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appData)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    setSyncBadge('☁️ Cloud Sync');
    if (!silent) setSyncStatus(`✅ Đã đồng bộ lên Cloud lúc ${new Date().toLocaleTimeString('vi-VN')}!`);
  } catch (err) {
    setSyncBadge('⚠️ Lỗi Sync');
    if (!silent) setSyncStatus(`❌ Lỗi đẩy dữ liệu (${err.message}).`);
  } finally {
    isSyncing = false;
  }
}

async function pullCloud(silent = false) {
  if (isSyncing || autoPushTimer) return;
  isSyncing = true;
  if (!silent) setSyncStatus('⏳ Đang tải dữ liệu từ Cloud...');
  try {
    const res = await fetch(`${CLOUD_ENDPOINT}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const remote = await res.json();
    if (!remote) {
      if (!silent && appData.updatedAt > 0) await pushCloud(true);
      if (!silent) setSyncStatus('☁️ Cloud sẵn sàng tự động đồng bộ.');
      return;
    }
    const remoteTime = Number(remote.updatedAt || 0);
    const localTime = Number(appData.updatedAt || 0);

    // Chỉ cập nhật khi Cloud có bản mới hơn (hoặc khi người dùng bấm tải thủ công)
    if (!silent || remoteTime > localTime) {
      appData = {
        ...defaultData,
        ...remote,
        wishes: Array.isArray(remote.wishes) ? remote.wishes : [],
        memories: Array.isArray(remote.memories) ? remote.memories : [],
        hurts: Array.isArray(remote.hurts) ? remote.hurts : []
      };
      localStorage.setItem(DATA_KEY, JSON.stringify(appData));
      renderAll();
    }
    setSyncBadge('☁️ Cloud Sync');
    if (!silent) setSyncStatus(`✅ Đã đồng bộ dữ liệu mới nhất lúc ${new Date().toLocaleTimeString('vi-VN')}!`);
  } catch (err) {
    if (!silent) setSyncStatus(`❌ Lỗi tải dữ liệu (${err.message}).`);
  } finally {
    isSyncing = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (uiCfg.theme === 'light') document.documentElement.setAttribute('data-theme', 'light');

  const today = new Date().toISOString().split('T')[0];
  const memDate = document.getElementById('memoryDate');
  const hurtDate = document.getElementById('hurtDate');
  if (memDate) memDate.value = today;
  if (hurtDate) hurtDate.value = today;

  const qEl = document.getElementById('dailyQuote');
  if (qEl) qEl.textContent = QUOTES[new Date().getDate() % QUOTES.length];

  renderAll();
  setInterval(updateTimer, 1000);

  // Tự động tải ngay khi mở web, khi quay lại tab trên điện thoại, và kiểm tra ngầm mỗi 5 giây
  pullCloud(true);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') pullCloud(true);
  });
  window.addEventListener('focus', () => pullCloud(true));
  setInterval(() => {
    if (document.visibilityState === 'visible') pullCloud(true);
  }, 5000);

  // Chuyển tab dưới đáy
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const tabId = btn.getAttribute('data-tab');
      if (tabId) document.getElementById(tabId)?.classList.add('active');
    });
  });

  // Đổi giao diện Sáng/Tối
  document.getElementById('btnTheme')?.addEventListener('click', () => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    if (isLight) {
      document.documentElement.removeAttribute('data-theme');
      uiCfg.theme = 'dark';
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      uiCfg.theme = 'light';
    }
    saveCfg();
  });

  // Avatar & Biệt danh
  [1, 2].forEach(idx => {
    document.getElementById(`avatar${idx}Box`)?.addEventListener('click', () => {
      document.getElementById(`avatar${idx}Input`)?.click();
    });
    document.getElementById(`avatar${idx}Input`)?.addEventListener('change', async e => {
      const file = e.target?.files?.[0];
      if (!file) return;
      appData[`avatar${idx}`] = await compressImage(file, 160, 0.7);
      saveData();
      renderAvatarsAndNames();
    });
    document.getElementById(`btnEditName${idx}`)?.addEventListener('click', () => {
      const nextName = window.prompt('Nhập biệt danh mới:', appData[`name${idx}`]);
      if (nextName && nextName.trim()) {
        appData[`name${idx}`] = nextName.trim();
        saveData();
        renderAvatarsAndNames();
      }
    });
  });

  // Ngày bắt đầu yêu
  document.getElementById('startDateInput')?.addEventListener('change', e => {
    const val = e.target?.value;
    if (val) {
      appData.startDate = val;
      saveData();
      updateTimer();
    }
  });

  // Form Mong muốn
  document.getElementById('wishForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const contentEl = document.getElementById('wishContent');
    const content = contentEl?.value.trim() || '';
    if (!content) return;
    appData.wishes = appData.wishes || [];
    appData.wishes.unshift({
      id: String(Date.now()),
      direction: document.getElementById('wishDirection')?.value || 'anh_to_em',
      content,
      priority: document.getElementById('wishPriority')?.value || 'Nhẹ nhàng 🌸',
      done: false
    });
    if (contentEl) contentEl.value = '';
    saveData();
    renderWishes();
  });
  document.getElementById('wishFilter')?.addEventListener('change', renderWishes);

  // Form Kỷ niệm
  let pendingPhoto = '';
  document.getElementById('memoryPhotoInput')?.addEventListener('change', async e => {
    const file = e.target?.files?.[0];
    if (!file) return;
    pendingPhoto = await compressImage(file, 600, 0.65);
    const lbl = document.getElementById('memoryPhotoLabel');
    if (lbl) lbl.textContent = `✅ Đã chọn ảnh: ${file.name}`;
  });
  document.getElementById('memoryForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const titleEl = document.getElementById('memoryTitle');
    const locEl = document.getElementById('memoryLocation');
    const noteEl = document.getElementById('memoryNote');
    const title = titleEl?.value.trim() || '';
    if (!title) return;
    appData.memories = appData.memories || [];
    appData.memories.unshift({
      id: String(Date.now()),
      date: document.getElementById('memoryDate')?.value || today,
      location: locEl?.value.trim() || '',
      title,
      note: noteEl?.value.trim() || '',
      photo: pendingPhoto
    });
    pendingPhoto = '';
    if (titleEl) titleEl.value = '';
    if (locEl) locEl.value = '';
    if (noteEl) noteEl.value = '';
    const lbl = document.getElementById('memoryPhotoLabel');
    if (lbl) lbl.textContent = '🖼️ Chọn 1 ảnh kỷ niệm (tùy chọn)';
    saveData();
    renderMemories();
  });

  // Form Tâm sự
  document.getElementById('hurtForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const contentEl = document.getElementById('hurtContent');
    const healEl = document.getElementById('hurtHeal');
    const content = contentEl?.value.trim() || '';
    if (!content) return;
    appData.hurts = appData.hurts || [];
    appData.hurts.unshift({
      id: String(Date.now()),
      sender: document.getElementById('hurtSender')?.value || 'Anh',
      date: document.getElementById('hurtDate')?.value || today,
      content,
      heal: healEl?.value.trim() || '',
      healed: false
    });
    if (contentEl) contentEl.value = '';
    if (healEl) healEl.value = '';
    saveData();
    renderHurts();
  });

  // Xử lý nút Hoàn thành / Xóa
  document.addEventListener('click', e => {
    const btn = e.target instanceof Element ? e.target.closest('[data-action]') : null;
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    const id = btn.getAttribute('data-id');
    if (!id) return;

    if (action === 'toggle-wish') {
      const item = (appData.wishes || []).find(w => w.id === id);
      if (item) { item.done = !item.done; saveData(); renderWishes(); }
    } else if (action === 'del-wish') {
      appData.wishes = (appData.wishes || []).filter(w => w.id !== id);
      saveData(); renderWishes();
    } else if (action === 'del-memory') {
      appData.memories = (appData.memories || []).filter(m => m.id !== id);
      saveData(); renderMemories();
    } else if (action === 'toggle-hurt') {
      const item = (appData.hurts || []).find(h => h.id === id);
      if (item) { item.healed = !item.healed; saveData(); renderHurts(); }
    } else if (action === 'del-hurt') {
      appData.hurts = (appData.hurts || []).filter(h => h.id !== id);
      saveData(); renderHurts();
    }
  });

  // Modal Cloud Sync
  const modal = document.getElementById('syncModal');
  document.getElementById('btnOpenSync')?.addEventListener('click', () => {
    const chk = document.getElementById('autoPullCheck');
    if (chk) chk.checked = true;
    if (modal) modal.hidden = false;
  });
  document.getElementById('btnCloseSync')?.addEventListener('click', () => {
    if (modal) modal.hidden = true;
  });
  modal?.addEventListener('click', e => {
    if (e.target === modal) modal.hidden = true;
  });

  document.getElementById('btnPushCloud')?.addEventListener('click', () => pushCloud(false));
  document.getElementById('btnPullCloud')?.addEventListener('click', () => pullCloud(false));
  document.getElementById('autoPullCheck')?.addEventListener('change', e => {
    uiCfg.autoPull = Boolean(e.target?.checked);
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
    const file = e.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        appData = { ...defaultData, ...JSON.parse(String(ev.target?.result || '{}')) };
        saveData();
        renderAll();
        setSyncStatus('✅ Đã khôi phục dữ liệu từ file .json!');
      } catch {
        setSyncStatus('❌ File .json không hợp lệ.');
      }
    };
    reader.readAsText(file);
  });
});