import { create } from 'zustand'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../lib/firebase.js'

export const useAuthStore = create((set, get) => ({
  user:    null,
  orgId:   null,
  loading: true,   // true while Firebase resolves the session

  // Called once in App.jsx to sync Firebase auth state
  init: () => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Load org info from Firestore
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid))
        const orgId = snap.exists() ? snap.data().orgId : null
        set({ user: firebaseUser, orgId, loading: false })
      } else {
        set({ user: null, orgId: null, loading: false })
      }
    })
  },

  signup: async (orgName, email, password) => {
    // 1. Create Firebase Auth user
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    const uid  = cred.user.uid

    // 2. Create org document
    const orgRef = doc(db, 'organizations', uid)   // use uid as orgId for simplicity
    await setDoc(orgRef, {
      name:      orgName,
      ownerId:   uid,
      createdAt: serverTimestamp(),
    })

    // 3. Create user document
    await setDoc(doc(db, 'users', uid), {
      email,
      orgId:     uid,
      role:      'admin',
      createdAt: serverTimestamp(),
    })

    set({ user: cred.user, orgId: uid })
    return cred.user
  },

  login: async (email, password) => {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    const snap = await getDoc(doc(db, 'users', cred.user.uid))
    const orgId = snap.exists() ? snap.data().orgId : null
    set({ user: cred.user, orgId })
    return cred.user
  },

  logout: async () => {
    await signOut(auth)
    set({ user: null, orgId: null })
  },
}))
