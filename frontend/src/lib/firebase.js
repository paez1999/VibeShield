import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey:            'AIzaSyAByn9Fxp-eHMyenU1QKMZq3cQVsFgXq5o',
  authDomain:        'vibeshield-f36cd.firebaseapp.com',
  projectId:         'vibeshield-f36cd',
  storageBucket:     'vibeshield-f36cd.firebasestorage.app',
  messagingSenderId: '168802590686',
  appId:             '1:168802590686:web:1bc1e7c14fe366c081874f',
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db   = getFirestore(app)
export default app
