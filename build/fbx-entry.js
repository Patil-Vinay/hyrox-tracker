// Thin wrapper around the Firebase SDK. Bundled into public/firebase-sdk.js.
// The app talks only to window.FBX, so the rest of the code never imports Firebase directly.
import { initializeApp } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect,
  getRedirectResult, signOut, connectAuthEmulator
} from 'firebase/auth';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache,
  collection, doc, setDoc, deleteDoc, onSnapshot, connectFirestoreEmulator
} from 'firebase/firestore';

import { getStorage, ref as sref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';

let app = null, auth = null, fs = null, st = null, cfg = null;

function init(config, opts = {}) {
  cfg = config;
  app = initializeApp(config);
  auth = getAuth(app);
  let cache;
  try { cache = persistentLocalCache({ tabManager: persistentMultipleTabManager() }); }
  catch (e) { cache = memoryLocalCache(); }
  fs = initializeFirestore(app, { localCache: cache });
  if (opts.authEmulator) connectAuthEmulator(auth, opts.authEmulator, { disableWarnings: true });
  if (opts.firestoreEmulator) connectFirestoreEmulator(fs, opts.firestoreEmulator.host, opts.firestoreEmulator.port);
  return true;
}

function onAuth(cb) { return onAuthStateChanged(auth, u => cb(u ? { uid: u.uid, email: u.email || '', name: u.displayName || '', verified: !!u.emailVerified } : null)); }

async function signIn(preferRedirect) {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: 'select_account' });
  if (preferRedirect) return signInWithRedirect(auth, p);
  try { await signInWithPopup(auth, p); }
  catch (e) {
    const c = e && e.code;
    if (c === 'auth/popup-blocked' || c === 'auth/operation-not-supported-in-this-environment' || c === 'auth/web-storage-unsupported') return signInWithRedirect(auth, p);
    throw e;
  }
}

function redirectResult() { return getRedirectResult(auth); }
function out() { return signOut(auth); }

// Firestore-shaped API used by the tracker: collection(c).onSnapshot / collection(c).doc(id).set|delete
const db = {
  collection(col) {
    return {
      onSnapshot(next, err) {
        return onSnapshot(collection(fs, col), { includeMetadataChanges: true }, snap => {
          if (snap.metadata.hasPendingWrites && !snap.docChanges().length) return; // our own write being confirmed: nothing new
          next({
            fromCache: snap.metadata.fromCache,
            docs: snap.docs.map(d => ({ id: d.id, data: d.data() }))
          });
        }, e => err && err(e));
      },
      doc(id) {
        const ref = doc(fs, col, id);
        return { set: data => setDoc(ref, data), delete: () => deleteDoc(ref) };
      }
    };
  }
};

// Full-quality photos in Cloud Storage for Firebase (needs the Blaze plan + a Storage bucket)
function bucket() {
  if (!st) st = cfg.storageBucket ? getStorage(app) : getStorage(app, 'gs://' + cfg.projectId + '.firebasestorage.app');
  return st;
}
const storage = {
  upload(path, blob, contentType, onProgress) {
    return new Promise((resolve, reject) => {
      const r = sref(bucket(), path);
      const task = uploadBytesResumable(r, blob, { contentType, cacheControl: 'public, max-age=31536000' });
      task.on('state_changed', s => onProgress && onProgress(s.bytesTransferred, s.totalBytes), reject,
        () => getDownloadURL(r).then(url => resolve({ url }), reject));
    });
  },
  remove(path) { return deleteObject(sref(bucket(), path)); }
};

window.FBX = { init, onAuth, signIn, redirectResult, signOut: out, db, storage };
