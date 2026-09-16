// qr.html: 自分のQRコード表示・相手のQRコード読み取り

const el = (id) => document.getElementById(id);
let qrInstance = null;

(async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return; }

  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('slug')
    .eq('user_id', session.user.id)
    .maybeSingle();

  renderQRCode(profile?.slug || '');
  switchTab('share');
})();

// ---------- タブ切り替え ----------
function switchTab(name) {
  el('tab-share').style.display = name === 'share' ? '' : 'none';
  el('tab-scan').style.display = name === 'scan' ? '' : 'none';
  el('tab-btn-share').classList.toggle('active', name === 'share');
  el('tab-btn-scan').classList.toggle('active', name === 'scan');
  if (name !== 'scan') stopScan();
}

el('tab-btn-share').addEventListener('click', () => switchTab('share'));
el('tab-btn-scan').addEventListener('click', () => switchTab('scan'));

function renderQRCode(slug) {
  const wrap = el('qr-wrap');
  const msg = el('qr-msg');
  if (!slug) {
    wrap.innerHTML = '';
    msg.textContent = '先にマイページでプロフィールを保存してください';
    return;
  }
  msg.textContent = '';
  wrap.innerHTML = '';
  qrInstance = new QRCode(wrap, {
    text: publicUrlFor(slug),
    width: 200,
    height: 200,
    colorDark: '#1c1b22',
    colorLight: '#ffffff',
  });
}

// ---------- QRコードを読み取る ----------
let scanStream = null;
let scanRAF = null;

el('scan-start-btn').addEventListener('click', async () => {
  const msg = el('scan-msg');
  msg.textContent = '';
  msg.className = 'msg';
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

function onQrDetected(text) {
  stopScan();
  const msg = el('scan-msg');
  let url = null;
  try { url = new URL(text); } catch (_) { /* not a URL */ }
  if (url && (url.protocol === 'http:' || url.protocol === 'https:')) {
    msg.innerHTML = `名刺ページが見つかりました: <a href="${escapeHtml(url.href)}" target="_blank" rel="noopener">開く</a>`;
    msg.className = 'msg success';
  } else {
    msg.textContent = '読み取った内容はURLではありませんでした: ' + text;
    msg.className = 'msg error';
  }
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
