# Firebase Setup — Step-by-Step

## 1 · Create a Firebase project

1. Go to **https://console.firebase.google.com**
2. Click **"Add project"**
3. Enter a name (e.g. `login-app`) → Continue
4. Disable Google Analytics (optional) → **Create project**

---

## 2 · Enable Email/Password authentication

1. Left sidebar → **Authentication** → **Get started**
2. **Sign-in method** tab → click **Email/Password**
3. Toggle the first switch **Enable** → **Save**

---

## 3 · Create a Firestore database

1. Left sidebar → **Firestore Database** → **Create database**
2. Choose **Start in test mode** (fine for development)
3. Pick a location → **Enable**

> ⚠️ **Production tip:** Before going live, lock down Firestore rules (see Step 7 below).

---

## 4 · Get your Firebase config

1. Gear icon ⚙️ (top-left) → **Project settings**
2. Scroll to **"Your apps"** → click the **`</>`** web icon
3. App nickname: `login-app-web` → **Register app**
4. Copy the `firebaseConfig` object shown (looks like this):

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "my-project.firebaseapp.com",
  projectId: "my-project",
  storageBucket: "my-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

---

## 5 · Paste your config into app.js

Open **`app.js`** and replace the placeholder block near the top:

```js
// ── FIREBASE CONFIG ─────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",          // ← replace
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",       // ← replace
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId:             "YOUR_APP_ID"
};
```

---

## 6 · Authorize GitHub Pages domain

1. Firebase Console → **Authentication** → **Settings** tab
2. **Authorized domains** section → **Add domain**
3. Add: `wuhsupbroe.github.io`
4. Click **Add**

---

## 7 · (Recommended) Tighten Firestore security rules

Go to **Firestore Database → Rules** and replace the default with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      // Any logged-in user can read all user docs (for the admin panel)
      allow read: if request.auth != null;
      // Each user can only write their own document
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Click **Publish**.

---

## 8 · Commit & push

```bash
cd login-app
git add app.js
git commit -m "Add Firebase config"
git push
```

Your site will be live at:
**https://wuhsupbroe.github.io/login-app/**

GitHub Pages may take 1–2 minutes to deploy after the first push.
