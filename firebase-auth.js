// =============================================
// OPTIONS PANEL TOGGLE (always runs, no Firebase dependency)
// =============================================
function setupOptionsPanel() {
    const optionsBtn = document.getElementById('options-btn');
    const optionsPanel = document.getElementById('options-panel');
    const optionsOverlay = document.getElementById('options-overlay');

    if (optionsBtn && optionsPanel) {
        optionsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            optionsPanel.classList.toggle('hidden');
            if (optionsOverlay) optionsOverlay.classList.toggle('hidden');
        });
    }

    if (optionsOverlay) {
        optionsOverlay.addEventListener('click', () => {
            if (optionsPanel) optionsPanel.classList.add('hidden');
            optionsOverlay.classList.add('hidden');
        });
    }

    const googleSignInBtn = document.getElementById('google-signin-btn');
    if (googleSignInBtn) {
        googleSignInBtn.addEventListener('click', () => {
            if (optionsPanel) optionsPanel.classList.add('hidden');
            if (optionsOverlay) optionsOverlay.classList.add('hidden');
            if (typeof signInWithGoogle === 'function') signInWithGoogle();
        });
    }

    const signOutBtn = document.getElementById('sign-out-btn');
    if (signOutBtn) {
        signOutBtn.addEventListener('click', () => {
            if (optionsPanel) optionsPanel.classList.add('hidden');
            if (optionsOverlay) optionsOverlay.classList.add('hidden');
            if (typeof signOut === 'function') signOut();
        });
    }
}

// Run immediately if DOM is ready, or wait for it
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupOptionsPanel);
} else {
    setupOptionsPanel();
}

// =============================================
// FIREBASE AUTH + FIRESTORE SYNC
// Wrapped safely — if Firebase CDN fails, the panel still works
// =============================================

const firebaseConfig = {
    apiKey: "AIzaSyCnDN1qsAJ6IvqNIfB6eb5o5cJnXj0m-RU",
    authDomain: "student-planner-dashboard.firebaseapp.com",
    projectId: "student-planner-dashboard",
    storageBucket: "student-planner-dashboard.firebasestorage.app",
    messagingSenderId: "1038666277106",
    appId: "1:1038666277106:web:21c718512d6a5ca1a1306b",
    measurementId: "G-EJP81KBTV9"
};

let auth, firestore, currentUser = null;

try {
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    firestore = firebase.firestore();

    // ---- OVERRIDE saveData to also sync to cloud ----
    const _originalSaveData = window.saveData;
    window.saveData = function () {
        if (_originalSaveData) _originalSaveData();
        if (currentUser && window.db) saveToCloud(window.db);
    };

    // ---- AUTH STATE LISTENER ----
    auth.onAuthStateChanged(async (user) => {
        currentUser = user;
        updateAuthUI(user);
        if (user) {
            const cloudData = await loadFromCloud();
            if (cloudData && window.db) {
                window.db = { ...window.db, ...cloudData };
                if (window.saveData) window.saveData();
                if (window.renderAll) window.renderAll();
            }
        }
    });

} catch (e) {
    console.warn('Firebase not available (offline or CDN blocked):', e.message);
}

// ---- FIRESTORE SYNC ----
async function saveToCloud(data) {
    if (!currentUser || !firestore) return;
    try {
        await firestore.collection('users').doc(currentUser.uid).set(data);
    } catch (e) {
        console.error('Cloud save failed:', e);
    }
}

async function loadFromCloud() {
    if (!currentUser || !firestore) return null;
    try {
        const doc = await firestore.collection('users').doc(currentUser.uid).get();
        if (doc.exists) return doc.data();
    } catch (e) {
        console.error('Cloud load failed:', e);
    }
    return null;
}

// ---- SIGN IN / OUT ----
function signInWithGoogle() {
    if (!auth) { alert('Sign-in not available (offline?)'); return; }
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(e => {
        console.error('Sign in failed:', e);
        alert('Sign in failed: ' + e.message);
    });
}

function signOut() {
    if (auth) auth.signOut();
}

// ---- UI UPDATES ----
function updateAuthUI(user) {
    const signedOut = document.getElementById('auth-signed-out');
    const signedIn = document.getElementById('auth-signed-in');
    const userName = document.getElementById('auth-user-name');
    const userPhoto = document.getElementById('auth-user-photo');
    const optionsBtn = document.getElementById('options-btn');

    if (!signedOut || !signedIn) return;

    if (user) {
        signedOut.classList.add('hidden');
        signedIn.classList.remove('hidden');
        if (userName) userName.textContent = user.displayName || user.email;
        if (userPhoto && user.photoURL) {
            userPhoto.src = user.photoURL;
            userPhoto.classList.remove('hidden');
        }
        if (optionsBtn && user.photoURL) {
            optionsBtn.innerHTML = `<img src="${user.photoURL}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;" />`;
        }
    } else {
        signedOut.classList.remove('hidden');
        signedIn.classList.add('hidden');
        if (optionsBtn) {
            optionsBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size: 18px;">settings</span>`;
        }
    }
}
