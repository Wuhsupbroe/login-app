// ── Firebase imports (CDN modules) ─────────────────────────────────────────────
import { initializeApp }                        from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword,
         signInWithEmailAndPassword, signOut,
         onAuthStateChanged, GoogleAuthProvider,
         signInWithPopup }                      from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, collection,
         getDocs, serverTimestamp, getCountFromServer,
         query, orderBy }                       from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ── FIREBASE CONFIG ─────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyDkrzifUy1sCGvuniL312Pp7Lh13Wt2DKI",
  authDomain:        "login-app-b0f88.firebaseapp.com",
  projectId:         "login-app-b0f88",
  storageBucket:     "login-app-b0f88.firebasestorage.app",
  messagingSenderId: "760154109686",
  appId:             "1:760154109686:web:42670bf2f61ed599b89ed7"
};

const app      = initializeApp(firebaseConfig);
const auth     = getAuth(app);
const db       = getFirestore(app);
const gProvider = new GoogleAuthProvider();

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
const adminWelcomeCard = document.getElementById('admin-welcome-card');
const userMapSection   = document.getElementById('user-map-section');
const userEmailDisplay = document.getElementById('user-email-display');
const userEmailMap     = document.getElementById('user-email-map');
const verifiedStatus   = document.getElementById('verified-status');
const navDashboard     = document.getElementById('nav-dashboard');
const navAdmin         = document.getElementById('nav-admin');
const logoutBtn        = document.getElementById('logout-btn');
const totalUsersEl     = document.getElementById('total-users');
const latestUserEl     = document.getElementById('latest-user');
const usersListEl      = document.getElementById('users-list');
const googleLoginBtn   = document.getElementById('google-login-btn');
const googleSignupBtn  = document.getElementById('google-signup-btn');

// ── Role & animation state ───────────────────────────────────────────────────────
let currentRole       = null;
let mapInitialized    = false;
let currentCancelToken = null;

// ── Auth state listener ─────────────────────────────────────────────────────────
onAuthStateChanged(auth, async user => {
  if (user) {
    // Cancel any running map animation immediately
    if (currentCancelToken) currentCancelToken.cancelled = true;

    authContainer.classList.add('hidden');
    appContainer.classList.remove('hidden');

    // Fetch role from Firestore
    let role = 'user';
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc    = await getDoc(userDocRef);
      if (userDoc.exists() && userDoc.data().role) {
        role = userDoc.data().role;
      } else {
        // Legacy account missing role — if only user in system, grant admin
        const countSnap = await getCountFromServer(collection(db, 'users'));
        role = countSnap.data().count <= 1 ? 'admin' : 'user';
        await setDoc(userDocRef, { role }, { merge: true });
      }
    } catch (e) {
      console.warn('Role fetch failed, defaulting to user', e);
    }

    currentRole = role;

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
      if (!mapInitialized) {
        mapInitialized = true;
        initUserMap();
      }
    }

    showAppView('dashboard');
  } else {
    if (currentCancelToken) currentCancelToken.cancelled = true;
    currentRole    = null;
    mapInitialized = false;
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

  // Block non-admins from accessing admin view
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

// ── Google Sign-In ──────────────────────────────────────────────────────────────
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

// ── Logout ──────────────────────────────────────────────────────────────────────
logoutBtn.addEventListener('click', () => {
  if (currentCancelToken) currentCancelToken.cancelled = true;
  signOut(auth);
});

// ── Determine role for new signup ───────────────────────────────────────────────
async function determineRole() {
  try {
    const snap = await getCountFromServer(collection(db, 'users'));
    return snap.data().count === 0 ? 'admin' : 'user';
  } catch {
    return 'user';
  }
}

// ── Admin data ──────────────────────────────────────────────────────────────────
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
      const d         = docSnap.data();
      const initial   = (d.email || '?')[0].toUpperCase();
      const date      = d.createdAt?.toDate();
      const dateStr   = date ? formatDate(date) : 'Just now';
      const isAdmin   = d.role === 'admin';
      const badgeCls  = isAdmin ? 'user-badge admin-badge' : 'user-badge';
      const badgeTxt  = isAdmin ? 'Admin' : 'Active';
      html += `
        <div class="user-row">
          <div class="user-avatar">${initial}</div>
          <div class="user-info">
            <div class="user-email">${escapeHtml(d.email || 'Unknown')}</div>
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

// ── US Map Animation ────────────────────────────────────────────────────────────
// West → East FIPS order (all 50 states)
const WEST_TO_EAST_FIPS = [
  15, 2,                    // HI, AK
  53, 41, 6,                // WA, OR, CA
  32, 16, 30, 56,           // NV, ID, MT, WY
  49,  4,  8, 35,           // UT, AZ, CO, NM
  38, 46, 31, 20, 40,       // ND, SD, NE, KS, OK
  48,                       // TX
  27, 19, 29,  5, 22,       // MN, IA, MO, AR, LA
  55, 17, 26, 18,           // WI, IL, MI, IN
  28, 47, 21,  1,           // MS, TN, KY, AL
  39, 13, 12,               // OH, GA, FL
  36, 42, 37, 45,           // NY, PA, NC, SC
  51, 54, 24, 10,           // VA, WV, MD, DE
  34,  9, 44, 25,           // NJ, CT, RI, MA
  50, 33, 23                // VT, NH, ME
];

function getStateColor(index, total) {
  const t     = index / Math.max(total - 1, 1);
  const hue   = Math.round(15 + t * 255);          // 15=coral → 270=purple
  const sat   = Math.round(78 + Math.sin(t * Math.PI) * 14);
  const light = Math.round(55 + Math.sin(t * Math.PI * 0.8) * 8);
  return `hsl(${hue},${sat}%,${light}%)`;
}

async function initUserMap() {
  const mapContainer = document.getElementById('map-container');
  if (!mapContainer) return;

  // New cancel token for this session
  if (currentCancelToken) currentCancelToken.cancelled = true;
  const token = { cancelled: false };
  currentCancelToken = token;

  mapContainer.innerHTML = '<div class="map-loading"><div class="spinner" style="width:28px;height:28px;border-width:3px"></div></div>';

  try {
    const [d3, topojson] = await Promise.all([
      import('https://esm.sh/d3@7'),
      import('https://esm.sh/topojson-client@3')
    ]);

    const us = await fetch('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json')
      .then(r => { if (!r.ok) throw new Error('fetch failed'); return r.json(); });

    if (token.cancelled) return;

    mapContainer.innerHTML = '';

    const svg = d3.select(mapContainer)
      .append('svg')
      .attr('viewBox', '0 0 960 600')
      .attr('width', '100%')
      .style('display', 'block')
      .style('border-radius', '12px');

    // Ocean / background
    svg.append('rect')
      .attr('width', 960).attr('height', 600)
      .attr('fill', '#06061a');

    // SVG glow filter
    const defs   = svg.append('defs');
    const filter = defs.append('filter').attr('id', 'state-glow').attr('x', '-20%').attr('y', '-20%').attr('width', '140%').attr('height', '140%');
    filter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'blur');
    const merge  = filter.append('feMerge');
    merge.append('feMergeNode').attr('in', 'blur');
    merge.append('feMergeNode').attr('in', 'SourceGraphic');

    const pathGen  = d3.geoPath();
    const features = topojson.feature(us, us.objects.states).features;

    // Base state fills (dark, unlit)
    svg.selectAll('.state')
      .data(features)
      .enter()
      .append('path')
      .attr('class', 'state')
      .attr('d', pathGen)
      .attr('data-fips', d => d.id)
      .attr('fill', '#0d0d28')
      .attr('stroke', '#1a1a3e')
      .attr('stroke-width', '0.8');

    // State borders mesh (thin, on top)
    svg.append('path')
      .datum(topojson.mesh(us, us.objects.states, (a, b) => a !== b))
      .attr('fill', 'none')
      .attr('stroke', '#22224a')
      .attr('stroke-width', '0.5');

    startMapAnimation(svg, features, d3, token);

  } catch (err) {
    console.error('Map init error:', err);
    if (!token.cancelled) {
      mapContainer.innerHTML = `
        <div style="text-align:center;padding:60px 20px;">
          <div class="success-icon" style="margin:0 auto 20px;">✓</div>
          <h2 style="font-size:22px;font-weight:700;">You have successfully logged in!</h2>
        </div>`;
    }
  }
}

function startMapAnimation(svg, features, d3, token) {
  if (token.cancelled) return;

  const ordered = WEST_TO_EAST_FIPS
    .map(fips => features.find(f => +f.id === fips))
    .filter(Boolean);

  // Append any state not covered by the ordered list
  const seen = new Set(ordered.map(f => f.id));
  features.forEach(f => { if (!seen.has(f.id)) ordered.push(f); });

  const STEP_MS  = 310;
  const FILL_MS  = 620;
  const total    = ordered.length;

  ordered.forEach((feature, i) => {
    const color      = getStateColor(i, total);
    const flashColor = `hsl(${Math.round(15 + (i / total) * 255)},100%,85%)`;

    setTimeout(() => {
      if (token.cancelled) return;
      svg.select(`path[data-fips="${feature.id}"]`)
        .attr('filter', 'url(#state-glow)')
        .transition().duration(140).ease(d3.easeExpOut)
        .attr('fill', flashColor)
        .transition().duration(FILL_MS).ease(d3.easeCubicInOut)
        .attr('fill', color)
        .attr('filter', 'none');
    }, i * STEP_MS);
  });

  // Pause, fade out, loop
  const resetAt = total * STEP_MS + FILL_MS + 2800;
  setTimeout(() => {
    if (token.cancelled) return;
    svg.selectAll('.state')
      .transition().duration(1400).ease(d3.easeLinear)
      .attr('fill', '#0d0d28');
    setTimeout(() => {
      if (!token.cancelled) startMapAnimation(svg, features, d3, token);
    }, 1600);
  }, resetAt);
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
