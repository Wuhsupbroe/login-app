// ── Firebase imports (CDN modules) ─────────────────────────────────────────────
import { initializeApp }                        from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword,
         signInWithEmailAndPassword, signOut,
         onAuthStateChanged }                   from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, setDoc, collection,
         getDocs, serverTimestamp,
         query, orderBy }                       from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ── FIREBASE CONFIG ─────────────────────────────────────────────────────────────
// TODO: Replace ALL placeholder values with your real Firebase project config.
// See FIREBASE_SETUP.md for step-by-step instructions.
const firebaseConfig = {
  apiKey:            "AIzaSyDkrzifUy1sCGvuniL312Pp7Lh13Wt2DKI",
  authDomain:        "login-app-b0f88.firebaseapp.com",
  projectId:         "login-app-b0f88",
  storageBucket:     "login-app-b0f88.firebasestorage.app",
  messagingSenderId: "760154109686",
  appId:             "1:760154109686:web:42670bf2f61ed599b89ed7"
};
// ───────────────────────────────────────────────────────────────────────────────

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── DOM refs ────────────────────────────────────────────────────────────────────
const authContainer    = document.getElementById('auth-container');
const appContainer     = document.getElementById('app-container');
const loginView        = document.getElementById('login-view');
const signupView       = document.getElementById('signup-view');
const loginError       = document.getElementById('login-error');
const signupError      = document.getElementById('signup-error');
const loginForm        = document.getElementById('login-form');
const signupForm       = document.getElementById('signup-form');
const loginBtn         = document.getElementById('login-btn');
const signupBtn        = document.getElementById('signup-btn');
const dashboardView    = document.getElementById('dashboard-view');
const adminView        = document.getElementById('admin-view');
const userEmailDisplay = document.getElementById('user-email-display');
const verifiedStatus   = document.getElementById('verified-status');
const navDashboard     = document.getElementById('nav-dashboard');
const navAdmin         = document.getElementById('nav-admin');
const logoutBtn        = document.getElementById('logout-btn');
const totalUsersEl     = document.getElementById('total-users');
const latestUserEl     = document.getElementById('latest-user');
const usersListEl      = document.getElementById('users-list');

// ── Auth state listener ─────────────────────────────────────────────────────────
onAuthStateChanged(auth, user => {
  if (user) {
    authContainer.classList.add('hidden');
    appContainer.classList.remove('hidden');
    userEmailDisplay.textContent = user.email;
    verifiedStatus.textContent   = user.emailVerified ? 'Yes ✓' : 'No';
    showAppView('dashboard');
  } else {
    authContainer.classList.remove('hidden');
    appContainer.classList.add('hidden');
    showAuthView('login');
  }
});

// ── Auth view switching ─────────────────────────────────────────────────────────
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

// ── App view switching ──────────────────────────────────────────────────────────
function showAppView(view) {
  dashboardView.classList.remove('active');
  adminView.classList.remove('active');
  navDashboard.classList.remove('active');
  navAdmin.classList.remove('active');

  if (view === 'dashboard') {
    // Small delay so CSS transition fires after display:block
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

// ── Login ───────────────────────────────────────────────────────────────────────
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

// ── Signup ──────────────────────────────────────────────────────────────────────
signupForm.addEventListener('submit', async e => {
  e.preventDefault();
  const email    = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const confirm  = document.getElementById('signup-confirm').value;

  if (password !== confirm) {
    showError(signupError, 'passwords-mismatch');
    return;
  }

  setLoading(signupBtn, true);
  signupError.classList.add('hidden');

  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    // Record user in Firestore so admin can count / list signups
    await setDoc(doc(db, 'users', user.uid), {
      email:     user.email,
      uid:       user.uid,
      createdAt: serverTimestamp()
    });
  } catch (err) {
    showError(signupError, err.code);
  } finally {
    setLoading(signupBtn, false);
  }
});

// ── Logout ──────────────────────────────────────────────────────────────────────
logoutBtn.addEventListener('click', () => signOut(auth));

// ── Admin data ──────────────────────────────────────────────────────────────────
async function loadAdminData() {
  usersListEl.innerHTML = '<div class="loading-text">Loading users…</div>';
  totalUsersEl.textContent = '…';
  latestUserEl.textContent = '…';

  try {
    const q        = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    totalUsersEl.textContent = snapshot.size;

    if (snapshot.size === 0) {
      latestUserEl.textContent  = 'None';
      usersListEl.innerHTML     = '<div class="loading-text">No users registered yet.</div>';
      return;
    }

    const latestData = snapshot.docs[0].data();
    const latestDate = latestData.createdAt?.toDate();
    latestUserEl.textContent = latestDate ? formatDateShort(latestDate) : 'Just now';

    let html = '<div class="users-list-header">Recent Signups</div>';
    snapshot.docs.forEach(docSnap => {
      const d       = docSnap.data();
      const initial = (d.email || '?')[0].toUpperCase();
      const date    = d.createdAt?.toDate();
      const dateStr = date ? formatDate(date) : 'Just now';
      html += `
        <div class="user-row">
          <div class="user-avatar">${initial}</div>
          <div class="user-info">
            <div class="user-email">${escapeHtml(d.email || 'Unknown')}</div>
            <div class="user-date">Joined ${dateStr}</div>
          </div>
          <span class="user-badge">Active</span>
        </div>`;
    });
    usersListEl.innerHTML = html;

  } catch (err) {
    usersListEl.innerHTML = `<div class="loading-text">Error: ${escapeHtml(err.message)}</div>`;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────────
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
    'auth/user-not-found':        'No account found with this email.',
    'auth/wrong-password':        'Incorrect password. Please try again.',
    'auth/invalid-credential':    'Invalid email or password.',
    'auth/email-already-in-use':  'An account with this email already exists.',
    'auth/weak-password':         'Password must be at least 6 characters.',
    'auth/invalid-email':         'Please enter a valid email address.',
    'auth/too-many-requests':     'Too many attempts. Please wait and try again.',
    'auth/network-request-failed':'Network error — check your connection.',
    'passwords-mismatch':         'Passwords do not match.',
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
