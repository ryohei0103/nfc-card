// dashboard.html: プロフィール編集・デコレーション・NFC書き込み・アクセス解析

let currentUser = null;
let currentProfile = null; // { id, user_id, slug, display_name, title, avatar_url, phone, email, links, theme, is_published }

const el = (id) => document.getElementById(id);

function emptyProfile(userId) {
  return {
    id: null,
    user_id: userId,
    slug: '',
    display_name: '',
    title: '',
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
  if (currentProfile.id) loadStats();
})();

el('logout-btn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = 'index.html';
});

// ---------- フォームへの反映 ----------
function populateForm() {
  el('slug').value = currentProfile.slug || '';
  el('display_name').value = currentProfile.display_name || '';
  el('title').value = currentProfile.title || '';
  el('phone').value = currentProfile.phone || '';
  el('email_field').value = currentProfile.email || '';
  el('avatar-preview').src = currentProfile.avatar_url || placeholderAvatar();
  el('publish-toggle').checked = currentProfile.is_published !== false;
  el('accent-color').value = currentProfile.theme.accent || '#5b5bf0';

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

  currentProfile.slug = slug;
  currentProfile.display_name = el('display_name').value.trim();
  currentProfile.title = el('title').value.trim();
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
    if (!currentProfile._statsLoaded) { loadStats(); currentProfile._statsLoaded = true; }
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
    title: currentProfile.title,
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

el('accent-color').addEventListener('input', () => {
  currentProfile.theme.accent = el('accent-color').value;
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
  const url = publicUrlFor(currentProfile.slug);

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

// ---------- アクセス解析 ----------
async function loadStats() {
  if (!currentProfile.id) return;
  const [{ count: total }, { count: recent }, { count: contacts }] = await Promise.all([
    supabaseClient.from('profile_views').select('*', { count: 'exact', head: true }).eq('profile_id', currentProfile.id),
    supabaseClient.from('profile_views').select('*', { count: 'exact', head: true }).eq('profile_id', currentProfile.id).gte('viewed_at', new Date(Date.now() - 7 * 86400000).toISOString()),
    supabaseClient.from('contact_saves').select('*', { count: 'exact', head: true }).eq('profile_id', currentProfile.id),
  ]);
  el('stat-views-total').textContent = total ?? 0;
  el('stat-views-7d').textContent = recent ?? 0;
  el('stat-contacts').textContent = contacts ?? 0;
}
