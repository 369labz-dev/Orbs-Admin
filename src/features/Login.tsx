import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { browserLocalPersistence, browserSessionPersistence, sendPasswordResetEmail, setPersistence, signInWithEmailAndPassword } from 'firebase/auth';
import { Navigate } from 'react-router-dom';
import { CircleDot, LockKeyhole } from 'lucide-react';
import { auth } from '../lib/firebase';
import { useSession } from '../lib/session';
import { Notice } from '../lib/ui';
export function Login() {
    const { user, access, loading, error: sessionError, logout } = useSession();
    const { register, handleSubmit, getValues } = useForm<{
        email: string;
        password: string;
        remember: boolean;
    }>();
    const [error, setError] = useState<Error | null>(null), [busy, setBusy] = useState(false), [show, setShow] = useState(false), [message, setMessage] = useState('');
    if (loading)
        return <div className="login-shell"><p>Checking access…</p></div>;
    if (user && access?.role !== 'none' && access)
        return <Navigate to="/events" replace/>;
    return <main className="login-shell"><section className="login-brand"><CircleDot size={40}/><span>ORBS / CONTROL</span><h1>Every event.<br />Under control.</h1><p>Prepare the play area, manage rewards and keep the activation moving.</p></section>
    <section className="login-card"><LockKeyhole size={28}/><h2>{user ? 'Access required' : 'Welcome back'}</h2><p>{user ? 'This account has no admin access. Ask your organizer to assign access.' : 'Sign in with your organizer or redemption account.'}</p>
      <Notice error={error || (sessionError ? new Error(sessionError) : null)}/>{message && <div className="notice">{message}</div>}
      {user ? <button onClick={logout}>Sign out</button> : <form onSubmit={handleSubmit(async (values) => {
                setBusy(true);
                setError(null);
                try {
                    await setPersistence(auth, values.remember ? browserLocalPersistence : browserSessionPersistence);
                    await signInWithEmailAndPassword(auth, values.email, values.password);
                }
                catch (e) {
                    setError(e as Error);
                }
                finally {
                    setBusy(false);
                }
            })}><label>Email<input type="email" autoComplete="username" required {...register('email')}/></label>
        <label htmlFor="login-password">Password</label><div className="password"><input id="login-password" type={show ? 'text' : 'password'} autoComplete="current-password" required {...register('password')}/><button type="button" onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button></div>
        <label className="checkbox"><input type="checkbox" {...register('remember')}/>Remember me on this device</label>
        <button className="primary full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <button className="text-button" type="button" disabled={busy} onClick={async () => {
                setError(null);
                const email = getValues('email');
                if (!email) {
                    setError(new Error('Enter your email first.'));
                    return;
                }
                setBusy(true);
                try {
                    await sendPasswordResetEmail(auth, email);
                    setMessage('Password reset requested. Check your email.');
                }
                catch (e) {
                    setError(e as Error);
                }
                finally {
                    setBusy(false);
                }
            }}>Forgot password?</button>
      </form>}
      <small>Authorized staff only · {import.meta.env.VITE_FIREBASE_PROJECT_ID}</small>
    </section></main>;
}
