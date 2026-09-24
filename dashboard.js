// dashboard.html: 「プロフィール」「QRコード」タブ（プロフィール編集・デコレーション・NFC書き込み・アクセス解析・QR表示/読み取り）

let currentUser = null;
let currentProfile = null; // { id, user_id, slug, display_name, furigana, company, position, bio, avatar_url, phone, email, links, theme, is_published }
let qrInstance = null;
let scanStream = null;
let scanRAF = null;

const el = (id) => document.getElementById(id);

function emptyProfile(userId) {
  return {
    id: null,
    user_id: userId,
    slug: '',
    display_name: '',
    furigana: '',
    company: '',
    position: '',
    bio: '',
    avatar_url: null,
    phone: '',
    email: '',
    links: [],
    theme: defaultTheme(),
    is_published: true,
  };
}

// ---------- 初期化 ----------
(async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return; }
  currentUser = session.user;

  el('slug-prefix').textContent = publicUrlFor('(slug)');

  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('user_id', currentUser.id)
    .maybeSingle();

  if (error) {
    console.error(error);
  }

  currentProfile = data || emptyProfile(currentUser.id);
  if (!currentProfile.theme || Object.keys(currentProfile.theme).length === 0) {
    currentProfile.theme = defaultTheme();
  }
  if (!currentProfile.links) currentProfile.links = [];

  populateForm();
  renderWallpaperGrid();
  renderAccentGrid();
  renderQRCode();
})();

el('logout-btn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = 'index.html';
});

// ---------- タブ切り替え ----------
function switchTab(name) {
  el('tab-profile').style.display = name === 'profile' ? '' : 'none';
  el('tab-qr').style.display = name === 'qr' ? '' : 'none';
  el('tab-cards').style.display = name === 'cards' ? '' : 'none';
  el('tab-stats').style.display = name === 'stats' ? '' : 'none';
  el('tab-btn-profile').classList.toggle('active', name === 'profile');
  el('tab-btn-qr').classList.toggle('active', name === 'qr');
  el('tab-btn-cards').classList.toggle('active', name === 'cards');
  el('tab-btn-stats').classList.toggle('active', name === 'stats');
  if (name !== 'qr') stopScan();
  if (name === 'cards') loadSavedCards();
  if (name === 'stats') loadStats();
}

el('tab-btn-profile').addEventListener('click', () => switchTab('profile'));
el('tab-btn-qr').addEventListener('click', () => switchTab('qr'));
el('tab-btn-cards').addEventListener('click', () => switchTab('cards'));
el('tab-btn-stats').addEventListener('click', () => switchTab('stats'));
switchTab('profile');

// ---------- フォームへの反映 ----------
function populateForm() {
  el('slug').value = currentProfile.slug || '';
  el('display_name').value = currentProfile.display_name || '';
  el('furigana').value = currentProfile.furigana || '';
  el('company').value = currentProfile.company || '';
  el('position').value = currentProfile.position || '';
  el('bio').value = currentProfile.bio || '';
  el('phone').value = currentProfile.phone || '';
  el('email_field').value = currentProfile.email || '';
  el('avatar-preview').src = currentProfile.avatar_url || placeholderAvatar();
  el('publish-toggle').checked = currentProfile.is_published !== false;

  renderLinks();
  updatePublicUrlDisplay();
}

function placeholderAvatar() {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#eeeef5"/><text x="50" y="58" font-size="40" text-anchor="middle">🙂</text></svg>'
  );
}

function updatePublicUrlDisplay() {
  const slug = el('slug').value.trim();
  const url = slug ? publicUrlFor(slug) : '（URLを設定してください）';
  el('public-url-text').textContent = url;
  el('open-public-link').href = slug ? publicUrlFor(slug) : '#';
}
el('slug').addEventListener('input', updatePublicUrlDisplay);

function renderQRCode() {
  const wrap = el('qr-wrap');
  const msg = el('qr-msg');
  if (!currentProfile.slug) {
    wrap.innerHTML = '';
    qrInstance = null;
    msg.textContent = '先にプロフィールを保存してください';
    return;
  }
  msg.textContent = '';
  const url = publicUrlFor(currentProfile.slug, 'qr');
  if (qrInstance) {
    qrInstance.clear();
    qrInstance.makeCode(url);
  } else {
    wrap.innerHTML = '';
    qrInstance = new QRCode(wrap, { text: url, width: 200, height: 200, colorDark: '#1c1b22', colorLight: '#ffffff' });
  }
}

el('copy-url-btn').addEventListener('click', async () => {
  const slug = el('slug').value.trim();
  if (!slug) return;
  await navigator.clipboard.writeText(publicUrlFor(slug));
  el('copy-url-btn').textContent = 'コピー済み';
  setTimeout(() => { el('copy-url-btn').textContent = 'コピー'; }, 1500);
});

// ---------- リンク編集 ----------
function renderLinks() {
  const list = el('links-list');
  list.innerHTML = '';
  currentProfile.links.forEach((link, idx) => list.appendChild(buildLinkRow(link, idx)));
}

function buildLinkRow(link, idx) {
  const row = document.createElement('div');
  row.className = 'link-row';

  const select = document.createElement('select');
  Object.entries(LINK_TYPES).forEach(([key, meta]) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = `${meta.icon} ${meta.label}`;
    if (key === link.type) opt.selected = true;
    select.appendChild(opt);
  });
  select.addEventListener('change', () => { currentProfile.links[idx].type = select.value; });

  const input = document.createElement('input');
  input.type = 'url';
  input.placeholder = 'https://...';
  input.value = link.url || '';
  input.addEventListener('input', () => { currentProfile.links[idx].url = input.value; });

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'remove-link';
  removeBtn.textContent = '×';
  removeBtn.addEventListener('click', () => {
    currentProfile.links.splice(idx, 1);
    renderLinks();
  });

  row.appendChild(select);
  row.appendChild(input);
  row.appendChild(removeBtn);
  return row;
}

el('add-link-btn').addEventListener('click', () => {
  currentProfile.links.push({ type: 'instagram', url: '' });
  renderLinks();
});

// ---------- アバターアップロード ----------
el('avatar-btn').addEventListener('click', () => el('avatar-input').click());
el('avatar-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const url = await uploadAsset(file, 'avatar');
    currentProfile.avatar_url = url;
    el('avatar-preview').src = url + '?t=' + Date.now();
  } catch (err) {
    alert('画像のアップロードに失敗しました: ' + err.message);
  }
});

async function uploadAsset(file, prefix) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${currentUser.id}/${prefix}.${ext}`;
  const { error } = await supabaseClient.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { upsert: true, cacheControl: '3600' });
  if (error) throw error;
  const { data } = supabaseClient.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ---------- プロフィール保存 ----------
el('profile-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = el('profile-msg');
  const btn = el('save-profile-btn');
  msg.textContent = '';
  msg.className = 'msg';

  const slug = el('slug').value.trim().toLowerCase();
  if (!/^[a-z0-9](-?[a-z0-9]+)*$/.test(slug) || slug.length < 3 || slug.length > 40) {
    msg.textContent = 'URLは半角英数とハイフンで3〜40文字にしてください';
    msg.className = 'msg error';
    return;
  }

  const required = [['display_name', 'お名前'], ['furigana', 'ふりがな'], ['phone', '電話番号']];
  const missing = required.find(([id]) => !el(id).value.trim());
  if (missing) {
    msg.textContent = `${missing[1]}を入力してください`;
    msg.className = 'msg error';
    el(missing[0]).focus();
    return;
  }

  currentProfile.slug = slug;
  currentProfile.display_name = el('display_name').value.trim();
  currentProfile.furigana = el('furigana').value.trim();
  currentProfile.company = el('company').value.trim();
  currentProfile.position = el('position').value.trim();
  currentProfile.bio = el('bio').value.trim();
  currentProfile.phone = el('phone').value.trim();
  currentProfile.email = el('email_field').value.trim();
  currentProfile.is_published = el('publish-toggle').checked;

  btn.disabled = true;
  msg.textContent = '保存中...';

  try {
    await persistProfile();
    msg.textContent = '保存しました';
    msg.className = 'msg success';
    updatePublicUrlDisplay();
    renderQRCode();
  } catch (err) {
    if (err.code === '23505' || /duplicate key/.test(err.message || '')) {
      msg.textContent = 'このURLはすでに使われています。別のURLをお試しください。';
    } else {
      msg.textContent = '保存に失敗しました: ' + err.message;
    }
    msg.className = 'msg error';
  } finally {
    btn.disabled = false;
  }
});

async function persistProfile() {
  const payload = {
    user_id: currentProfile.user_id,
    slug: currentProfile.slug,
    display_name: currentProfile.display_name,
    furigana: currentProfile.furigana,
    company: currentProfile.company,
    position: currentProfile.position,
    bio: currentProfile.bio,
    avatar_url: currentProfile.avatar_url,
    phone: currentProfile.phone,
    email: currentProfile.email,
    links: currentProfile.links,
    theme: currentProfile.theme,
    is_published: currentProfile.is_published,
  };
  const { data, error } = await supabaseClient
    .from('profiles')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) throw error;
  currentProfile = { ...currentProfile, ...data };
}

// ---------- 公開トグル（即時反映） ----------
el('publish-toggle').addEventListener('change', async () => {
  currentProfile.is_published = el('publish-toggle').checked;
  if (currentProfile.id) {
    await supabaseClient.from('profiles').update({ is_published: currentProfile.is_published }).eq('id', currentProfile.id);
  }
});

// ---------- デコレーション: 壁紙 ----------
function renderWallpaperGrid() {
  const grid = el('wallpaper-grid');
  grid.innerHTML = '';
  WALLPAPER_PRESETS.forEach((preset) => {
    const sw = document.createElement('div');
    sw.className = 'swatch';
    sw.style.backgroundImage = preset.value;
    if (currentProfile.theme.bg_type === 'preset' && currentProfile.theme.bg_value === preset.value) {
      sw.classList.add('selected');
    }
    const label = document.createElement('span');
    label.className = 'swatch-label';
    label.textContent = preset.label;
    sw.appendChild(label);
    sw.addEventListener('click', () => {
      currentProfile.theme.bg_type = 'preset';
      currentProfile.theme.bg_value = preset.value;
      renderWallpaperGrid();
    });
    grid.appendChild(sw);
  });

  if (currentProfile.theme.bg_type === 'image' && currentProfile.theme.bg_value) {
    const sw = document.createElement('div');
    sw.className = 'swatch selected';
    sw.style.backgroundImage = `url("${currentProfile.theme.bg_value}")`;
    sw.style.backgroundSize = 'cover';
    sw.style.backgroundPosition = 'center';
    const label = document.createElement('span');
    label.className = 'swatch-label';
    label.textContent = 'アップロード画像';
    sw.appendChild(label);
    grid.appendChild(sw);
  }
}

el('wallpaper-upload-btn').addEventListener('click', () => el('wallpaper-input').click());
el('wallpaper-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const url = await uploadAsset(file, 'wallpaper');
    currentProfile.theme.bg_type = 'image';
    currentProfile.theme.bg_value = url + '?t=' + Date.now();
    renderWallpaperGrid();
  } catch (err) {
    alert('壁紙のアップロードに失敗しました: ' + err.message);
  }
});

// ---------- デコレーション: アクセントカラー ----------
function renderAccentGrid() {
  const grid = el('accent-grid');
  grid.innerHTML = '';
  const presetValues = ACCENT_PRESETS.map((p) => p.value);
  ACCENT_PRESETS.forEach((preset) => {
    const sw = document.createElement('div');
    sw.className = 'swatch';
    sw.style.background = preset.value;
    if (currentProfile.theme.accent === preset.value) sw.classList.add('selected');
    const label = document.createElement('span');
    label.className = 'swatch-label';
    label.textContent = preset.label;
    sw.appendChild(label);
    sw.addEventListener('click', () => {
      currentProfile.theme.accent = preset.value;
      renderAccentGrid();
    });
    grid.appendChild(sw);
  });

  if (currentProfile.theme.accent && !presetValues.includes(currentProfile.theme.accent)) {
    const sw = document.createElement('div');
    sw.className = 'swatch selected';
    sw.style.background = currentProfile.theme.accent;
    const label = document.createElement('span');
    label.className = 'swatch-label';
    label.textContent = 'カスタム';
    sw.appendChild(label);
    grid.appendChild(sw);
  }
}

el('accent-custom-btn').addEventListener('click', () => el('accent-color-input').click());
el('accent-color-input').addEventListener('input', () => {
  currentProfile.theme.accent = el('accent-color-input').value;
  renderAccentGrid();
});

el('save-theme-btn').addEventListener('click', async () => {
  const msg = el('theme-msg');
  msg.textContent = '保存中...';
  msg.className = 'msg';
  try {
    if (!currentProfile.slug) {
      msg.textContent = '先に上の「プロフィール」を保存してください';
      msg.className = 'msg error';
      return;
    }
    await persistProfile();
    msg.textContent = '保存しました';
    msg.className = 'msg success';
  } catch (err) {
    msg.textContent = '保存に失敗しました: ' + err.message;
    msg.className = 'msg error';
  }
});

// ---------- NFC書き込み ----------
el('nfc-write-btn').addEventListener('click', async () => {
  const status = el('nfc-status');
  if (!currentProfile.slug || !currentProfile.id) {
    status.textContent = '先にプロフィールを保存してください';
    return;
  }
  const url = publicUrlFor(currentProfile.slug, 'nfc');

  if (!('NDEFReader' in window)) {
    status.innerHTML =
      'このブラウザ・端末はWeb NFCの書き込みに対応していません（対応: AndroidのChrome）。<br>' +
      'iPhoneなど非対応の場合は「NFC Tools」などのアプリで下記URLをタグに書き込んでください。<br>' +
      `<span style="user-select:all;">${escapeHtml(url)}</span>`;
    return;
  }

  try {
    status.textContent = 'NFCタグをスマホ背面に近づけてください...';
    const ndef = new NDEFReader();
    await ndef.write({ records: [{ recordType: 'url', data: url }] });
    status.textContent = '書き込みが完了しました！';
  } catch (err) {
    status.textContent = '書き込みに失敗しました: ' + err.message;
  }
});

// ---------- QRコードを読み取る ----------
el('scan-start-btn').addEventListener('click', async () => {
  const msg = el('scan-msg');
  msg.textContent = '';
  msg.className = 'msg';
  el('scan-result').innerHTML = '';
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  } catch (err) {
    msg.textContent = 'カメラを使用できませんでした: ' + err.message;
    msg.className = 'msg error';
    return;
  }
  const video = el('scan-video');
  video.srcObject = scanStream;
  video.style.display = '';
  await video.play();
  el('scan-start-btn').style.display = 'none';
  el('scan-stop-btn').style.display = '';
  scanLoop();
});

el('scan-stop-btn').addEventListener('click', stopScan);

function scanLoop() {
  const video = el('scan-video');
  const canvas = el('scan-canvas');
  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (code && code.data) {
      onQrDetected(code.data);
      return;
    }
  }
  scanRAF = requestAnimationFrame(scanLoop);
}

async function onQrDetected(text) {
  stopScan();
  const msg = el('scan-msg');
  const result = el('scan-result');
  result.innerHTML = '';
  let url = null;
  try { url = new URL(text); } catch (_) { /* not a URL */ }
  if (!url || (url.protocol !== 'http:' && url.protocol !== 'https:')) {
    msg.textContent = '読み取った内容はURLではありませんでした: ' + text;
    msg.className = 'msg error';
    return;
  }

  const slug = (url.searchParams.get('u') || '').toLowerCase();
  const { data: card } = slug
    ? await supabaseClient
        .from('profiles')
        .select('id, user_id, slug, display_name, furigana, company, position, avatar_url')
        .eq('slug', slug)
        .eq('is_published', true)
        .maybeSingle()
    : { data: null };

  if (!card) {
    msg.innerHTML = `名刺ページではありませんでした: <a href="${escapeHtml(url.href)}" target="_blank" rel="noopener">開く</a>`;
    msg.className = 'msg error';
    return;
  }

  msg.textContent = '';
  msg.className = 'msg';
  const box = document.createElement('div');
  box.className = 'scan-result-box';
  box.innerHTML = `
    <img src="${escapeHtml(card.avatar_url || placeholderAvatar())}" alt="">
    <div class="info">
      <div class="n">${escapeHtml(card.display_name)}</div>
      <div class="s">${escapeHtml([card.company, card.position].filter(Boolean).join(' / '))}</div>
    </div>
    <div class="actions">
      <a class="btn secondary small" href="${escapeHtml(publicUrlFor(card.slug))}" target="_blank" rel="noopener">開く</a>
      <button type="button" class="btn small" id="scan-save-btn">保存</button>
    </div>`;
  result.appendChild(box);

  box.querySelector('#scan-save-btn').addEventListener('click', async () => {
    if (card.user_id === currentUser.id) {
      msg.textContent = '自分の名刺です';
      msg.className = 'msg error';
      return;
    }
    const { error } = await supabaseClient.from('saved_cards').insert({ user_id: currentUser.id, card_profile_id: card.id });
    if (error && error.code !== '23505') {
      msg.textContent = '保存に失敗しました: ' + error.message;
      msg.className = 'msg error';
      return;
    }
    msg.textContent = error ? 'すでに名刺帳に保存済みです' : '名刺帳に保存しました';
    msg.className = 'msg success';
  });
}

// ---------- 名刺帳 ----------
async function loadSavedCards() {
  const list = el('saved-list');
  const msg = el('saved-msg');
  msg.textContent = '';
  const { data, error } = await supabaseClient
    .from('saved_cards')
    .select('id, created_at, card:card_profile_id(slug, display_name, furigana, company, position, avatar_url)');
  if (error) {
    msg.textContent = '読み込みに失敗しました: ' + error.message;
    msg.className = 'msg error';
    return;
  }
  const collator = new Intl.Collator('ja');
  const sortKey = (c) => c.furigana || c.display_name || '';
  const rows = (data || []).filter((r) => r.card).sort((a, b) => collator.compare(sortKey(a.card), sortKey(b.card)));
  if (!rows.length) {
    list.innerHTML = '';
    msg.textContent = 'まだ保存した名刺はありません';
    msg.className = 'msg';
    return;
  }
  list.innerHTML = '';
  rows.forEach((r) => {
    const c = r.card;
    const item = document.createElement('div');
    item.className = 'saved-item';
    item.innerHTML = `
      <img src="${escapeHtml(c.avatar_url || placeholderAvatar())}" alt="">
      <div class="info">
        <div class="n">${escapeHtml(c.display_name)}</div>
        <div class="s">${escapeHtml([c.company, c.position].filter(Boolean).join(' / ') || c.furigana || '')}</div>
      </div>
      <div class="actions">
        <a class="btn secondary small" href="${escapeHtml(publicUrlFor(c.slug))}" target="_blank" rel="noopener">開く</a>
        <button type="button" class="btn ghost small">削除</button>
      </div>`;
    item.querySelector('button').addEventListener('click', async () => {
      if (!confirm(`${c.display_name} さんの名刺を名刺帳から削除しますか？`)) return;
      await supabaseClient.from('saved_cards').delete().eq('id', r.id);
      loadSavedCards();
    });
    list.appendChild(item);
  });
}

function stopScan() {
  if (scanRAF) cancelAnimationFrame(scanRAF);
  scanRAF = null;
  if (scanStream) {
    scanStream.getTracks().forEach((t) => t.stop());
    scanStream = null;
  }
  el('scan-video').style.display = 'none';
  el('scan-start-btn').style.display = '';
  el('scan-stop-btn').style.display = 'none';
}

// ---------- アクセス解析 ----------
async function loadStats() {
  if (!currentProfile.id) return;
  const [{ count: total }, { count: recent }, { count: nfcTaps }, { count: linkClicks }, { count: contacts }] = await Promise.all([
    supabaseClient.from('profile_views').select('*', { count: 'exact', head: true }).eq('profile_id', currentProfile.id),
    supabaseClient.from('profile_views').select('*', { count: 'exact', head: true }).eq('profile_id', currentProfile.id).gte('viewed_at', new Date(Date.now() - 7 * 86400000).toISOString()),
    supabaseClient.from('profile_views').select('*', { count: 'exact', head: true }).eq('profile_id', currentProfile.id).eq('source', 'nfc'),
    supabaseClient.from('link_clicks').select('*', { count: 'exact', head: true }).eq('profile_id', currentProfile.id),
    supabaseClient.from('contact_saves').select('*', { count: 'exact', head: true }).eq('profile_id', currentProfile.id),
  ]);
  el('stat-views-total').textContent = total ?? 0;
  el('stat-views-7d').textContent = recent ?? 0;
  el('stat-nfc-taps').textContent = nfcTaps ?? 0;
  el('stat-link-clicks').textContent = linkClicks ?? 0;
  el('stat-contacts').textContent = contacts ?? 0;
}
