// p.html: 公開プロフィールページ（誰でも閲覧可）

(async function main() {
  const params = new URLSearchParams(window.location.search);
  const slug = (params.get('u') || '').trim().toLowerCase();
  const loading = document.getElementById('loading');
  const content = document.getElementById('content');

  if (!slug) {
    showNotFound();
    return;
  }

  const { data: profile, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();

  if (error || !profile) {
    showNotFound();
    return;
  }

  renderCard(profile);
  logView(profile.id);

  function showNotFound() {
    loading.textContent = 'このページは見つかりませんでした。';
  }

  function renderCard(p) {
    loading.hidden = true;
    content.hidden = false;

    const theme = { ...defaultTheme(), ...(p.theme || {}) };
    const linkTypes = LINK_TYPES;

    const links = (p.links || []).filter((l) => l.url);

    const card = document.createElement('div');
    card.className = 'namecard';
    applyThemeToCard(card, theme);

    const stickerHtml = theme.sticker && theme.sticker !== 'なし'
      ? `<div class="namecard-sticker">${escapeHtml(theme.sticker)}</div>` : '';

    const avatarSrc = p.avatar_url || placeholderAvatar();

    const linksHtml = links.map((l) => {
      const meta = linkTypes[l.type] || linkTypes.other;
      return `<a class="namecard-link" href="${escapeHtml(l.url)}" target="_blank" rel="noopener">
        <span class="icon">${meta.icon}</span><span>${escapeHtml(l.label || meta.label)}</span>
      </a>`;
    }).join('');

    const phoneHtml = p.phone
      ? `<a class="namecard-link" href="tel:${escapeHtml(p.phone)}"><span class="icon">📞</span><span>${escapeHtml(p.phone)}</span></a>` : '';
    const emailHtml = p.email
      ? `<a class="namecard-link" href="mailto:${escapeHtml(p.email)}"><span class="icon">✉️</span><span>${escapeHtml(p.email)}</span></a>` : '';

    card.innerHTML = `
      ${stickerHtml}
      <img class="avatar-preview" src="${escapeHtml(avatarSrc)}" alt="">
      <div class="name">${escapeHtml(p.display_name || '')}</div>
      ${p.title ? `<div class="title">${escapeHtml(p.title)}</div>` : ''}
      <div class="namecard-panel">
        <div class="namecard-links">${phoneHtml}${emailHtml}${linksHtml}</div>
        <div class="namecard-actions">
          <button class="btn btn-block" id="save-contact-btn">連絡先に保存</button>
        </div>
      </div>
    `;

    content.appendChild(card);

    card.querySelector('#save-contact-btn').addEventListener('click', () => {
      downloadVCard(p);
      logContactSave(p.id);
    });
  }

  function placeholderAvatar() {
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#eeeef5"/><text x="50" y="58" font-size="40" text-anchor="middle">🙂</text></svg>'
    );
  }

  async function logView(profileId) {
    try { await supabaseClient.from('profile_views').insert({ profile_id: profileId }); } catch (_) {}
  }

  async function logContactSave(profileId) {
    try { await supabaseClient.from('contact_saves').insert({ profile_id: profileId }); } catch (_) {}
  }
})();
