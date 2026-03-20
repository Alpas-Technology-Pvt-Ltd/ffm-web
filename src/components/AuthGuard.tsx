"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { AlertCircle } from 'lucide-react';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAuthorized(false);
        router.replace('/login');
        return;
      }

      try {
        // Enforce Supervisor/HR Role Check
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const role = userDoc.data().role;
          if (role === 'supervisor' || role === 'hr') {
            setAuthorized(true);
          } else {
            setErrorMsg('Access Denied: Terminal restricted to Command Operations.');
            setAuthorized(false);
            await auth.signOut();
            setTimeout(() => router.replace('/login'), 3000);
          }
        } else {
          setErrorMsg('Access Denied: Command Profile Not Found.');
          setAuthorized(false);
          await auth.signOut();
          setTimeout(() => router.replace('/login'), 3000);
        }
      } catch (err) {
        console.error(err);
        setErrorMsg('Network Validation Error. Checking Secure Connection.');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0d1527]">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full border-4 border-t-blue-500 border-r-transparent border-b-blue-500 border-l-transparent animate-spin" />
          <p className="text-blue-400 font-bold tracking-widest text-sm">AUTHENTICATING SIGNAL...</p>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#0d1527] text-slate-200">
        <div className="glass-panel p-8 max-w-md w-full text-center border-red-500/30">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <h2 className="text-xl font-bold text-white mb-2">SECURITY BREACH</h2>
          <p className="text-slate-400 text-sm mb-6">{errorMsg}</p>
          <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-red-500 w-full animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return authorized ? <>{children}</> : null;
}
