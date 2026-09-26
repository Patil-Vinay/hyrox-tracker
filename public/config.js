/*
  ADMINS: these Google accounts can change anyone's profile and logs, remove members and edit the plan.
  Everyone else can see everything but only change their own profile and logs.
  Keep this list the same as admins() in firestore.rules (Firebase enforces that one).
*/
window.TRACKER_ADMINS = ['admin@example.com'];

/*
  You don't need to change this file if you publish the tracker with Firebase Hosting
  (the setup guide's "firebase deploy" step): the tracker finds your Firebase settings automatically.

  Only if you host these files somewhere else (Netlify, Vercel, your own server):
  replace null below with the firebaseConfig object from
  Firebase console -> Project settings -> Your apps -> Web app, for example:

  window.FIREBASE_CONFIG = {
    apiKey: "AIza...",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project",
    appId: "1:1234567890:web:abc123"
  };

  ...and add that website's address under Authentication -> Settings -> Authorized domains.
*/
window.FIREBASE_CONFIG = null;
