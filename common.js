// 全ページ共通のヘルパー（Supabaseクライアント、vCard生成など）

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// リンクの種類 → 表示用アイコン・ラベル
const LINK_TYPES = {
  instagram: { icon: '📷', label: 'Instagram' },
  line: { icon: '💬', label: 'LINE' },
  x: { icon: '𝕏', label: 'X (Twitter)' },
  tiktok: { icon: '🎵', label: 'TikTok' },
  youtube: { icon: '▶️', label: 'YouTube' },
  facebook: { icon: '👤', label: 'Facebook' },
  website: { icon: '🔗', label: 'Webサイト' },
  other: { icon: '⭐️', label: 'その他' },
};

// 背景プリセット（グラデーション・単色）
const WALLPAPER_PRESETS = [
  { id: 'sunset', label: 'サンセット', value: 'linear-gradient(135deg, #ff9a8b 0%, #ff6a88 55%, #ff99ac 100%)' },
  { id: 'ocean', label: 'オーシャン', value: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { id: 'forest', label: 'フォレスト', value: 'linear-gradient(135deg, #56ab2f 0%, #a8e063 100%)' },
  { id: 'night', label: 'ナイト', value: 'linear-gradient(135deg, #232526 0%, #414345 100%)' },
  { id: 'lavender', label: 'ラベンダー', value: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)' },
  { id: 'mono', label: 'モノクロ', value: 'linear-gradient(135deg, #ece9e6 0%, #ffffff 100%)' },
  { id: 'gold', label: 'ゴールド', value: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)' },
  { id: 'mint', label: 'ミント', value: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
];

// キャラクター（ステッカー）プリセット
const STICKER_PRESETS = ['なし', '🐱', '🐶', '🐰', '🦊', '🐻', '🐼', '🦁', '🐨', '🌸', '⭐️', '🌈', '🔥', '✨', '🎮', '🎵', '📷', '☕️'];

function defaultTheme() {
  return {
    bg_type: 'preset',
    bg_value: WALLPAPER_PRESETS[0].value,
    accent: '#5b5bf0',
    sticker: 'なし',
  };
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

function publicUrlFor(slug) {
  const base = new URL('p.html', window.location.href);
  base.searchParams.set('u', slug);
  return base.toString();
}

// vCard(.vcf)を生成してダウンロードさせる
function downloadVCard(profile) {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
  lines.push(`FN:${(profile.display_name || '').replace(/\n/g, ' ')}`);
  if (profile.title) lines.push(`TITLE:${profile.title.replace(/\n/g, ' ')}`);
  if (profile.phone) lines.push(`TEL;TYPE=CELL:${profile.phone}`);
  if (profile.email) lines.push(`EMAIL:${profile.email}`);
  lines.push(`URL:${publicUrlFor(profile.slug)}`);
  (profile.links || []).forEach((l) => {
    if (l.url) lines.push(`URL;TYPE=${(l.type || 'other').toUpperCase()}:${l.url}`);
  });
  lines.push('END:VCARD');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${profile.display_name || 'contact'}.vcf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function applyThemeToCard(cardEl, theme) {
  const t = { ...defaultTheme(), ...(theme || {}) };
  cardEl.style.setProperty('--accent', t.accent || '#5b5bf0');
  if (t.bg_type === 'image' && t.bg_value) {
    cardEl.style.backgroundImage = `url("${t.bg_value}")`;
    cardEl.style.backgroundSize = 'cover';
    cardEl.style.backgroundPosition = 'center';
  } else {
    cardEl.style.backgroundImage = t.bg_value || WALLPAPER_PRESETS[0].value;
  }
  return t;
}
