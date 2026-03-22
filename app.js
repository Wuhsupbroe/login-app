// ── Firebase imports (CDN modules) ─────────────────────────────────────────────
import { initializeApp }                        from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword,
         signInWithEmailAndPassword, signOut,
         onAuthStateChanged, GoogleAuthProvider,
         signInWithPopup }                      from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, collection,
         getDocs, serverTimestamp, getCountFromServer,
         query, orderBy, limit }                from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ── FIREBASE CONFIG ─────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyDkrzifUy1sCGvuniL312Pp7Lh13Wt2DKI",
  authDomain:        "login-app-b0f88.firebaseapp.com",
  projectId:         "login-app-b0f88",
  storageBucket:     "login-app-b0f88.firebasestorage.app",
  messagingSenderId: "760154109686",
  appId:             "1:760154109686:web:42670bf2f61ed599b89ed7"
};

const app       = initializeApp(firebaseConfig);
const auth      = getAuth(app);
const db        = getFirestore(app);
const gProvider = new GoogleAuthProvider();

// ── DOM refs ────────────────────────────────────────────────────────────────────
const authContainer     = document.getElementById('auth-container');
const appContainer      = document.getElementById('app-container');
const nicknameContainer = document.getElementById('nickname-container');
const loginView         = document.getElementById('login-view');
const signupView        = document.getElementById('signup-view');
const loginError        = document.getElementById('login-error');
const signupError       = document.getElementById('signup-error');
const nicknameError     = document.getElementById('nickname-error');
const loginForm         = document.getElementById('login-form');
const signupForm        = document.getElementById('signup-form');
const nicknameForm      = document.getElementById('nickname-form');
const loginBtn          = document.getElementById('login-btn');
const signupBtn         = document.getElementById('signup-btn');
const nicknameBtn       = document.getElementById('nickname-btn');
const dashboardView     = document.getElementById('dashboard-view');
const adminView         = document.getElementById('admin-view');
const adminWelcomeCard  = document.getElementById('admin-welcome-card');
const userMapSection    = document.getElementById('user-map-section');
const userEmailDisplay  = document.getElementById('user-email-display');
const userEmailMap      = document.getElementById('user-email-map');
const verifiedStatus    = document.getElementById('verified-status');
const adminGreeting     = document.getElementById('admin-greeting');
const userGreeting      = document.getElementById('user-greeting');
const navDashboard      = document.getElementById('nav-dashboard');
const navAdmin          = document.getElementById('nav-admin');
const logoutBtn         = document.getElementById('logout-btn');
const totalUsersEl      = document.getElementById('total-users');
const latestUserEl      = document.getElementById('latest-user');
const usersListEl       = document.getElementById('users-list');
const googleLoginBtn    = document.getElementById('google-login-btn');
const googleSignupBtn   = document.getElementById('google-signup-btn');

// ── App state ───────────────────────────────────────────────────────────────────
let currentRole     = null;
let currentUser     = null;
let currentNickname = '';
let gameInitialized = false;

// ── Auth state listener ─────────────────────────────────────────────────────────
onAuthStateChanged(auth, async user => {
  currentUser = user;
  if (user) {
    authContainer.classList.add('hidden');

    let role = 'user', nickname = null;
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc    = await getDoc(userDocRef);
      if (userDoc.exists()) {
        const data = userDoc.data();
        nickname = data.nickname ?? null;
        if (data.role) {
          role = data.role;
        } else {
          const countSnap = await getCountFromServer(collection(db, 'users'));
          role = countSnap.data().count <= 1 ? 'admin' : 'user';
          await setDoc(userDocRef, { role }, { merge: true });
        }
      } else {
        const countSnap = await getCountFromServer(collection(db, 'users'));
        role = countSnap.data().count <= 1 ? 'admin' : 'user';
        await setDoc(userDocRef, { role }, { merge: true });
      }
    } catch (e) {
      console.warn('Role fetch failed, defaulting to user', e);
    }

    currentRole = role;

    if (!nickname) {
      nicknameContainer.classList.remove('hidden');
      appContainer.classList.add('hidden');
    } else {
      enterApp(user, nickname, role);
    }
  } else {
    currentUser     = null;
    currentNickname = '';
    currentRole     = null;
    gameInitialized = false;
    authContainer.classList.remove('hidden');
    appContainer.classList.add('hidden');
    nicknameContainer.classList.add('hidden');
    showAuthView('login');
  }
});

// ── Enter app after nickname is confirmed ────────────────────────────────────────
function enterApp(user, nickname, role) {
  currentNickname = nickname;
  nicknameContainer.classList.add('hidden');
  appContainer.classList.remove('hidden');

  const greetText = `Hi, ${nickname}!`;
  if (adminGreeting) adminGreeting.textContent = greetText;
  if (userGreeting)  userGreeting.textContent  = greetText;

  const email = user.email || user.displayName || '';
  if (userEmailDisplay) userEmailDisplay.textContent = email;
  if (userEmailMap)     userEmailMap.textContent     = email;
  if (verifiedStatus)   verifiedStatus.textContent   = user.emailVerified ? 'Yes ✓' : 'No';

  if (role === 'admin') {
    navAdmin.classList.remove('hidden');
    adminWelcomeCard.classList.remove('hidden');
    userMapSection.classList.add('hidden');
  } else {
    navAdmin.classList.add('hidden');
    adminWelcomeCard.classList.add('hidden');
    userMapSection.classList.remove('hidden');
    if (!gameInitialized) {
      gameInitialized = true;
      initGame();
    }
  }

  showAppView('dashboard');
}

// ── Nickname setup ───────────────────────────────────────────────────────────────
nicknameForm.addEventListener('submit', async e => {
  e.preventDefault();
  const nickname = document.getElementById('nickname-input').value.trim();
  if (!nickname) return;
  setLoading(nicknameBtn, true);
  nicknameError.classList.add('hidden');
  try {
    const user = auth.currentUser;
    await setDoc(doc(db, 'users', user.uid), { nickname }, { merge: true });
    enterApp(user, nickname, currentRole);
  } catch {
    nicknameError.textContent = 'Could not save nickname. Please try again.';
    nicknameError.classList.remove('hidden');
  } finally {
    setLoading(nicknameBtn, false);
  }
});

// ── Auth view switching ──────────────────────────────────────────────────────────
function showAuthView(view) {
  if (view === 'login') {
    loginView.classList.add('active');
    signupView.classList.remove('active');
  } else {
    signupView.classList.add('active');
    loginView.classList.remove('active');
  }
}

document.getElementById('go-signup').addEventListener('click', e => {
  e.preventDefault();
  signupError.classList.add('hidden');
  showAuthView('signup');
});
document.getElementById('go-login').addEventListener('click', e => {
  e.preventDefault();
  loginError.classList.add('hidden');
  showAuthView('login');
});

// ── App view switching ───────────────────────────────────────────────────────────
function showAppView(view) {
  dashboardView.classList.remove('active');
  adminView.classList.remove('active');
  navDashboard.classList.remove('active');
  navAdmin.classList.remove('active');

  if (view === 'admin' && currentRole !== 'admin') view = 'dashboard';

  if (view === 'dashboard') {
    requestAnimationFrame(() => {
      dashboardView.classList.add('active');
      navDashboard.classList.add('active');
    });
  } else {
    requestAnimationFrame(() => {
      adminView.classList.add('active');
      navAdmin.classList.add('active');
    });
    loadAdminData();
  }
}

navDashboard.addEventListener('click', e => { e.preventDefault(); showAppView('dashboard'); });
navAdmin.addEventListener('click',     e => { e.preventDefault(); showAppView('admin'); });

// ── Google Sign-In ───────────────────────────────────────────────────────────────
async function handleGoogleSignIn(btn, errorEl) {
  setLoading(btn, true);
  errorEl.classList.add('hidden');
  try {
    const result  = await signInWithPopup(auth, gProvider);
    const user    = result.user;
    const userRef = doc(db, 'users', user.uid);
    const snap    = await getDoc(userRef);
    if (!snap.exists()) {
      const role = await determineRole();
      await setDoc(userRef, {
        email:     user.email,
        uid:       user.uid,
        name:      user.displayName ?? null,
        provider:  'google',
        role,
        createdAt: serverTimestamp()
      });
    }
  } catch (err) {
    if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
      showError(errorEl, err.code);
    }
  } finally {
    setLoading(btn, false);
  }
}
googleLoginBtn.addEventListener('click',  () => handleGoogleSignIn(googleLoginBtn,  loginError));
googleSignupBtn.addEventListener('click', () => handleGoogleSignIn(googleSignupBtn, signupError));

// ── Login ────────────────────────────────────────────────────────────────────────
loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  setLoading(loginBtn, true);
  loginError.classList.add('hidden');
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    showError(loginError, err.code);
  } finally {
    setLoading(loginBtn, false);
  }
});

// ── Signup ───────────────────────────────────────────────────────────────────────
signupForm.addEventListener('submit', async e => {
  e.preventDefault();
  const email    = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const confirm  = document.getElementById('signup-confirm').value;
  if (password !== confirm) { showError(signupError, 'passwords-mismatch'); return; }
  setLoading(signupBtn, true);
  signupError.classList.add('hidden');
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    const role = await determineRole();
    await setDoc(doc(db, 'users', user.uid), {
      email:     user.email,
      uid:       user.uid,
      role,
      createdAt: serverTimestamp()
    });
  } catch (err) {
    showError(signupError, err.code);
  } finally {
    setLoading(signupBtn, false);
  }
});

// ── Logout ───────────────────────────────────────────────────────────────────────
logoutBtn.addEventListener('click', () => signOut(auth));

// ── Determine role for new signup ─────────────────────────────────────────────────
async function determineRole() {
  try {
    const snap = await getCountFromServer(collection(db, 'users'));
    return snap.data().count === 0 ? 'admin' : 'user';
  } catch {
    return 'user';
  }
}

// ── Admin data ───────────────────────────────────────────────────────────────────
async function loadAdminData() {
  usersListEl.innerHTML    = '<div class="loading-text">Loading users…</div>';
  totalUsersEl.textContent = '…';
  latestUserEl.textContent = '…';

  try {
    const q        = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    totalUsersEl.textContent = snapshot.size;

    if (snapshot.size === 0) {
      latestUserEl.textContent = 'None';
      usersListEl.innerHTML    = '<div class="loading-text">No users registered yet.</div>';
      return;
    }

    const latestData = snapshot.docs[0].data();
    const latestDate = latestData.createdAt?.toDate();
    latestUserEl.textContent = latestDate ? formatDateShort(latestDate) : 'Just now';

    let html = '<div class="users-list-header">Recent Signups</div>';
    snapshot.docs.forEach(docSnap => {
      const d           = docSnap.data();
      const initial     = (d.nickname || d.email || '?')[0].toUpperCase();
      const date        = d.createdAt?.toDate();
      const dateStr     = date ? formatDate(date) : 'Just now';
      const isAdmin     = d.role === 'admin';
      const badgeCls    = isAdmin ? 'user-badge admin-badge' : 'user-badge';
      const badgeTxt    = isAdmin ? 'Admin' : 'Active';
      const nicknameTag = d.nickname
        ? `<span class="user-nickname-tag">${escapeHtml(d.nickname)}</span>`
        : '<span class="user-nickname-tag no-nickname">No nickname</span>';
      html += `
        <div class="user-row">
          <div class="user-avatar">${initial}</div>
          <div class="user-info">
            <div class="user-email">${escapeHtml(d.email || 'Unknown')} ${nicknameTag}</div>
            <div class="user-date">Joined ${dateStr}</div>
          </div>
          <span class="${badgeCls}">${badgeTxt}</span>
        </div>`;
    });
    usersListEl.innerHTML = html;
  } catch (err) {
    usersListEl.innerHTML = `<div class="loading-text">Error: ${escapeHtml(err.message)}</div>`;
  }
}

// ── Game constants ───────────────────────────────────────────────────────────────
const GAME_DURATION   = 30;
const TARGET_LIFETIME = 1500;
const HIT_POINTS      = 10;
const MISS_PENALTY    = 2;
const TARGET_COLORS   = ['#6c63ff','#e060c0','#2196f3','#00c853','#ff9800','#f44336','#00bcd4','#ab47bc'];

// ── Game state ───────────────────────────────────────────────────────────────────
let gameActive    = false;
let gameScore     = 0;
let gameTimeLeft  = GAME_DURATION;
let timerInterval = null;
let spawnTimeout  = null;

// ── Game init ────────────────────────────────────────────────────────────────────
function initGame() {
  document.getElementById('game-start-btn').addEventListener('click', startGame);
  document.getElementById('game-restart-btn').addEventListener('click', startGame);
  loadLeaderboard();
}

// ── Start game ───────────────────────────────────────────────────────────────────
function startGame() {
  clearInterval(timerInterval);
  clearTimeout(spawnTimeout);

  const gameArea = document.getElementById('game-area');
  gameArea.querySelectorAll('.target, .float-score').forEach(el => el.remove());

  gameActive   = true;
  gameScore    = 0;
  gameTimeLeft = GAME_DURATION;

  document.getElementById('game-overlay').classList.add('hidden');
  document.getElementById('game-result').classList.add('hidden');
  updateHUD();

  scheduleSpawn();

  timerInterval = setInterval(() => {
    gameTimeLeft--;
    updateHUD();
    if (gameTimeLeft <= 0) endGame();
  }, 1000);
}

function updateHUD() {
  document.getElementById('score-val').textContent = gameScore;
  const timerEl = document.getElementById('timer-val');
  timerEl.textContent = gameTimeLeft;
  timerEl.classList.toggle('danger', gameTimeLeft <= 5);
}

// ── Spawn loop ───────────────────────────────────────────────────────────────────
function scheduleSpawn() {
  if (!gameActive) return;
  spawnTarget();
  const delay = Math.max(350, 920 - Math.floor(gameScore / 20) * 45);
  spawnTimeout = setTimeout(scheduleSpawn, delay);
}

function spawnTarget() {
  const gameArea = document.getElementById('game-area');
  const w = gameArea.clientWidth;
  const h = gameArea.clientHeight;

  const size   = Math.max(38, 72 - Math.floor(gameScore / 30) * 4);
  const margin = 12;
  const x      = Math.random() * (w - size - margin * 2) + margin;
  const y      = Math.random() * (h - size - margin * 2) + margin;
  const color  = TARGET_COLORS[Math.floor(Math.random() * TARGET_COLORS.length)];

  const el = document.createElement('div');
  el.className = 'target';
  el.style.cssText = [
    `left:${x}px`, `top:${y}px`,
    `width:${size}px`, `height:${size}px`,
    `background:${color}`,
    `box-shadow:0 0 ${Math.round(size * 0.5)}px ${color}55`
  ].join(';');

  gameArea.appendChild(el);

  // Pop-in (double rAF ensures element is painted before transition starts)
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('t-in')));

  // Fade warning at 60% of lifetime
  const fadeTimer = setTimeout(() => {
    if (el.isConnected) el.classList.add('t-fade');
  }, TARGET_LIFETIME * 0.6);

  // Click → hit
  el.addEventListener('pointerdown', e => {
    e.stopPropagation();
    if (!gameActive) return;
    clearTimeout(fadeTimer);
    clearTimeout(expireTimer);
    gameScore += HIT_POINTS;
    updateHUD();
    showFloat(`+${HIT_POINTS}`, x + size / 2, y, color);
    el.classList.add('t-hit');
    setTimeout(() => el.remove(), 230);
  });

  // Auto-expire → miss penalty
  const expireTimer = setTimeout(() => {
    clearTimeout(fadeTimer);
    if (!el.isConnected) return;
    if (gameActive && gameScore > 0) {
      gameScore = Math.max(0, gameScore - MISS_PENALTY);
      updateHUD();
      showFloat(`−${MISS_PENALTY}`, x + size / 2, y + size / 2, '#d93025');
    }
    el.classList.add('t-miss');
    setTimeout(() => el.remove(), 180);
  }, TARGET_LIFETIME);
}

function showFloat(text, x, y, color) {
  const gameArea = document.getElementById('game-area');
  const el = document.createElement('div');
  el.className = 'float-score';
  el.textContent = text;
  el.style.cssText = `left:${x}px;top:${y}px;color:${color}`;
  gameArea.appendChild(el);
  setTimeout(() => el.remove(), 700);
}

// ── End game ─────────────────────────────────────────────────────────────────────
async function endGame() {
  gameActive = false;
  clearInterval(timerInterval);
  clearTimeout(spawnTimeout);

  const gameArea = document.getElementById('game-area');
  gameArea.querySelectorAll('.target').forEach(el => {
    el.classList.add('t-miss');
    setTimeout(() => el.remove(), 180);
  });

  document.getElementById('result-score-val').textContent = gameScore;
  document.getElementById('result-msg').textContent = '';
  document.getElementById('game-result').classList.remove('hidden');

  if (currentUser) await submitScore(gameScore);
}

// ── Leaderboard — Firestore ───────────────────────────────────────────────────────
async function submitScore(score) {
  if (!currentUser || score === 0) return;
  const msgEl = document.getElementById('result-msg');
  try {
    const ref  = doc(db, 'leaderboard', currentUser.uid);
    const snap = await getDoc(ref);
    const prev = snap.exists() ? (snap.data().score ?? 0) : 0;
    if (score > prev) {
      await setDoc(ref, {
        uid:       currentUser.uid,
        nickname:  currentNickname,
        score,
        updatedAt: serverTimestamp()
      });
      msgEl.textContent = '🏆 New personal best!';
    } else {
      msgEl.textContent = `Your best: ${prev} pts`;
    }
    loadLeaderboard();
  } catch {
    msgEl.textContent = 'Score not saved — check your connection.';
  }
}

async function loadLeaderboard() {
  const listEl = document.getElementById('leaderboard-list');
  if (!listEl) return;
  listEl.innerHTML = '<div class="loading-text">Loading…</div>';
  try {
    const snap = await getDocs(
      query(collection(db, 'leaderboard'), orderBy('score', 'desc'), limit(10))
    );
    if (snap.empty) {
      listEl.innerHTML = '<div class="loading-text">No scores yet — be the first!</div>';
      return;
    }
    const medals = ['🥇', '🥈', '🥉'];
    listEl.innerHTML = snap.docs.map((d, i) => {
      const { nickname, score } = d.data();
      const isMe = currentUser?.uid === d.id;
      return `<div class="lb-row${isMe ? ' lb-row-me' : ''}">
        <span class="lb-rank">${medals[i] ?? `${i + 1}`}</span>
        <span class="lb-name">${escapeHtml(nickname || 'Anonymous')}</span>
        <span class="lb-score">${score} pts</span>
      </div>`;
    }).join('');
  } catch {
    listEl.innerHTML = '<div class="loading-text">Could not load leaderboard.</div>';
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────────
function setLoading(btn, on) {
  btn.querySelector('span').style.opacity    = on ? '0' : '1';
  btn.querySelector('.spinner').classList.toggle('hidden', !on);
  btn.disabled = on;
}

function showError(el, code) {
  el.textContent = errorMessage(code);
  el.classList.remove('hidden');
}

function errorMessage(code) {
  return ({
    'auth/user-not-found':         'No account found with this email.',
    'auth/wrong-password':         'Incorrect password. Please try again.',
    'auth/invalid-credential':     'Invalid email or password.',
    'auth/email-already-in-use':   'An account with this email already exists.',
    'auth/weak-password':          'Password must be at least 6 characters.',
    'auth/invalid-email':          'Please enter a valid email address.',
    'auth/too-many-requests':      'Too many attempts. Please wait and try again.',
    'auth/network-request-failed': 'Network error — check your connection.',
    'passwords-mismatch':          'Passwords do not match.',
  })[code] ?? 'Something went wrong. Please try again.';
}

function formatDate(d) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(d);
}

function formatDateShort(d) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  }).format(d);
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
