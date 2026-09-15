// index.html: ログイン・新規登録画面

const tabLogin = document.getElementById('tab-login');
const tabSignup = document.getElementById('tab-signup');
const authForm = document.getElementById('auth-form');
const submitBtn = document.getElementById('submit-btn');
const authMsg = document.getElementById('auth-msg');

let mode = 'login';

function setMode(next) {
  mode = next;
  tabLogin.classList.toggle('active', mode === 'login');
  tabSignup.classList.toggle('active', mode === 'signup');
  submitBtn.textContent = mode === 'login' ? 'ログイン' : '新規登録';
  authMsg.textContent = '';
  authMsg.className = 'msg';
}

tabLogin.addEventListener('click', () => setMode('login'));
tabSignup.addEventListener('click', () => setMode('signup'));

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  submitBtn.disabled = true;
  authMsg.textContent = '処理中...';
  authMsg.className = 'msg';

  try {
    if (mode === 'signup') {
      const { data, error } = await supabaseClient.auth.signUp({ email, password });
      if (error) throw error;
      if (data.session) {
        window.location.href = 'dashboard.html';
      } else {
        authMsg.textContent = '確認メールを送信しました。メール内のリンクから確認してください。';
        authMsg.className = 'msg success';
      }
    } else {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      window.location.href = 'dashboard.html';
    }
  } catch (err) {
    authMsg.textContent = err.message || 'エラーが発生しました';
    authMsg.className = 'msg error';
  } finally {
    submitBtn.disabled = false;
  }
});

(async function redirectIfLoggedIn() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) window.location.href = 'dashboard.html';
})();
