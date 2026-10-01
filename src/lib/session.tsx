import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { useQueryClient } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';
import { auth, adminCall } from './firebase';
import type { AccessResult } from './adminContract';
const Session = createContext<{
    user: User | null;
    access: AccessResult | null;
    loading: boolean;
    error: string;
    logout: () => Promise<void>;
    confirm: (text: string) => Promise<boolean>;
}>(null!);
export const useSession = () => useContext(Session);
export function SessionProvider({ children }: {
    children: ReactNode;
}) {
    const queryClient = useQueryClient();
    const [user, setUser] = useState<User | null>(null), [access, setAccess] = useState<AccessResult | null>(null);
    const [loading, setLoading] = useState(true), [error, setError] = useState('');
    const [confirmation, setConfirmation] = useState<{
        text: string;
        resolve: (answer: boolean) => void;
    } | null>(null);
    useEffect(() => onAuthStateChanged(auth, async (user) => {
        queryClient.clear();
        setUser(user);
        setAccess(null);
        setLoading(true);
        setError('');
        try {
            if (user) {
                const result = await adminCall<AccessResult>({ action: 'access' });
                if (auth.currentUser?.uid === user.uid)
                    setAccess(result);
            }
        }
        catch (e) {
            setError((e as Error).message);
        }
        finally {
            setLoading(false);
        }
    }), [queryClient]);
    useEffect(() => {
        const refreshAccess = async (event: any) => {
            const failure = event.query?.state.error ?? event.mutation?.state.error;
            if (failure?.code !== 'functions/permission-denied' || !auth.currentUser)
                return;
            const uid = auth.currentUser.uid;
            queryClient.clear();
            try {
                const result = await adminCall<AccessResult>({ action: 'access' });
                if (auth.currentUser?.uid === uid)
                    setAccess(result);
            }
            catch (e) {
                setError((e as Error).message);
            }
        };
        const stopQueries = queryClient.getQueryCache().subscribe(refreshAccess);
        const stopMutations = queryClient.getMutationCache().subscribe(refreshAccess);
        return () => { stopQueries(); stopMutations(); };
    }, [queryClient]);
    const answer = (value: boolean) => { confirmation?.resolve(value); setConfirmation(null); };
    return <Session.Provider value={{ user, access, loading, error, logout: () => signOut(auth), confirm: text => new Promise(resolve => setConfirmation({ text, resolve })) }}>
    {children}
    <Dialog.Root open={!!confirmation} onOpenChange={open => { if (!open)
        answer(false); }}>
      <Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content className="dialog">
        <Dialog.Title>Confirm action</Dialog.Title><Dialog.Description>{confirmation?.text}</Dialog.Description>
        <div className="actions"><button onClick={() => answer(false)}>Cancel</button><button className="primary" onClick={() => answer(true)}>Confirm</button></div>
      </Dialog.Content></Dialog.Portal>
    </Dialog.Root>
  </Session.Provider>;
}
