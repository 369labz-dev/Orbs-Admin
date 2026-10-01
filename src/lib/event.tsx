import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { doc, collection, onSnapshot } from 'firebase/firestore';
import { useParams } from 'react-router-dom';
import { firestore } from './firebase';
import type { Orb, OrbEvent } from '../../../backend/functions/src/model';
export type WebOrb = Orb & {
    id: string;
};
export type WebEvent = OrbEvent & {
    name?: string;
};
const EventContext = createContext<{
    eventId: string;
    event: WebEvent;
    orbs: WebOrb[];
    dirty: boolean;
    setDirty: (value: boolean) => void;
}>(null!);
export const useEvent = () => useContext(EventContext);
export function EventProvider({ children }: {
    children: ReactNode;
}) {
    const { eventId = '' } = useParams();
    const [event, setEvent] = useState<WebEvent | null>(null), [orbs, setOrbs] = useState<WebOrb[]>([]), [error, setError] = useState(''), [dirty, setDirty] = useState(false);
    useEffect(() => {
        setEvent(null);
        setOrbs([]);
        setError('');
        setDirty(false);
        const stopEvent = onSnapshot(doc(firestore, 'events', eventId), snap => {
            if (!snap.exists())
                setError('Event not found.');
            else
                setEvent(snap.data() as WebEvent);
        }, e => setError(e.message));
        const stopOrbs = onSnapshot(collection(firestore, 'events', eventId, 'orbs'), snap => setOrbs(snap.docs.map(d => ({ id: d.id, ...d.data() } as WebOrb))), e => setError(e.message));
        return () => { stopEvent(); stopOrbs(); };
    }, [eventId]);
    if (error)
        return <div className="notice error" role="alert">{error}</div>;
    if (!event)
        return <p>Loading event…</p>;
    return <EventContext.Provider value={{ eventId, event, orbs, dirty, setDirty }}>{children}</EventContext.Provider>;
}
