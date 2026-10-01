import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useBeforeUnload, useBlocker, useLocation } from 'react-router-dom';
import { CircleDot, Map, SlidersHorizontal, Package, Activity, TicketCheck, Users, BarChart3, LogOut, ArrowLeft } from 'lucide-react';
import { Login } from './features/Login';
import { Events } from './features/Events';
const MapScreen = lazy(() => import('./features/MapScreen').then(module => ({ default: module.MapScreen })));
import { Settings } from './features/Settings';
import { Inventory } from './features/Inventory';
import { Monitor } from './features/Monitor';
import { Redeem } from './features/Redeem';
import { Staff } from './features/Staff';
import { Report } from './features/Report';
import { useSession } from './lib/session';
import { EventProvider, useEvent } from './lib/event';
import { useAdminMutation, useAdminQuery, Notice, Badge, time } from './lib/ui';
function EventShell() {
    const { eventId, event, dirty } = useEvent(), { access, confirm } = useSession(), location = useLocation();
    const mutation = useAdminMutation(eventId), readiness = useAdminQuery({ action: 'readiness', eventId }, undefined, access?.role === 'organizer');
    const blocker = useBlocker(dirty);
    const [clock, setClock] = useState(Date.now());
    useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(timer); }, []);
    const serverClock = clock + (readiness.data ? readiness.data.serverNow - readiness.dataUpdatedAt : 0);
    const remaining = event.endsAt ? Math.max(0, Math.ceil((event.endsAt - serverClock) / 1000)) : null;
    useBeforeUnload(e => { if (dirty) {
        e.preventDefault();
        e.returnValue = '';
    } });
    useEffect(() => { if (blocker.state === 'blocked')
        confirm('Discard unsaved changes and leave this screen?').then(yes => yes ? blocker.proceed() : blocker.reset()); }, [blocker.state]);
    const organizer = access?.role === 'organizer';
    if (!organizer && !access!.eventIds.includes(eventId))
        return <Navigate to='/events' replace/>;
    if (!organizer && !location.pathname.endsWith('/redeem'))
        return <Navigate to={`/events/${eventId}/redeem`} replace/>;
    const transition = async (state: string) => {
        if (dirty && !await confirm('There are unsaved changes. Continue without saving them?'))
            return;
        if (state === 'active' && event.state === 'waiting') {
            const result = await readiness.refetch();
            if (!result.data?.canStart)
                return;
            const text = [...result.data.warnings, 'Start this event now?'].join('\n');
            if (!await confirm(text))
                return;
        }
        else if (!await confirm(state === 'ended' ? `Permanently end “${event.name || eventId}”? Claims stop; issued codes remain valid.` : state === 'paused' ? 'Pause gameplay? Attempts cannot complete and the event clock keeps running.' : 'Resume this event?'))
            return;
        mutation.mutate({ action: 'event', state, acknowledgeWarnings: true });
    };
    return <><div className="event-header"><div><div className="eyebrow">CURRENT ACTIVATION</div><h2>{event.name || eventId} <Badge value={event.state}/></h2><small>{event.endsAt ? `Remaining ${Math.floor((remaining ?? 0) / 60)}:${String((remaining ?? 0) % 60).padStart(2, "0")} · Cutoff ${time(event.endsAt)}` : 'Not started'}</small></div>{organizer && <div className="actions wrap">{event.state === 'waiting' && <button className="primary" disabled={mutation.isPending || remaining === 0} onClick={() => transition('active')}>Start event</button>}{event.state === 'active' && <button onClick={() => transition('paused')} disabled={mutation.isPending}>Pause</button>}{event.state === 'paused' && <button className="primary" onClick={() => transition('active')} disabled={mutation.isPending}>Resume</button>}{event.state !== 'ended' && <button className="danger" onClick={() => transition('ended')} disabled={mutation.isPending}>End event</button>}</div>}</div><Notice error={mutation.error}/>
    {organizer && event.state === 'waiting' && <details className="readiness"><summary>{readiness.data?.canStart ? 'Ready to launch' : 'Launch checklist'}</summary><Notice error={readiness.error}/>{readiness.data?.blockers.map((b: string) => <p key={b} className="error-text">{b}</p>)}{readiness.data?.warnings.map((w: string) => <p key={w}>{w}</p>)}<button onClick={() => readiness.refetch()}>Check again</button></details>}
    <nav className="event-nav" aria-label="Event sections">{(organizer ? [['map', 'Map', Map], ['settings', 'Settings', SlidersHorizontal], ['inventory', 'Inventory', Package], ['monitor', 'Monitor', Activity], ['redeem', 'Redeem', TicketCheck], ['staff', 'Staff', Users], ['report', 'Report', BarChart3]] : [['redeem', 'Redeem', TicketCheck]]).map(([path, label, Icon]: any) => <NavLink key={path} to={`/events/${eventId}/${path}`}><Icon size={16}/>{label}</NavLink>)}</nav>
    <Routes><Route path="map" element={<Suspense fallback={<p>Loading map…</p>}><MapScreen key={eventId}/></Suspense>}/><Route path="settings" element={<Settings key={eventId}/>}/><Route path="inventory" element={<Inventory key={eventId}/>}/><Route path="monitor" element={<Monitor key={eventId}/>}/><Route path="redeem" element={<Redeem key={eventId}/>}/><Route path="staff" element={<Staff key={eventId}/>}/><Route path="report" element={<Report key={eventId}/>}/><Route path="*" element={<Navigate to="map" replace/>}/></Routes>
  </>;
}
export function App() {
    const { user, access, loading, logout } = useSession();
    const location = useLocation();
    if (loading || !user || !access || access.role === 'none')
        return <Login />;
    return <div className="app-shell"><aside className="sidebar"><Link className="brand" to="/events"><CircleDot size={28}/><span>ORBS<small>EVENT CONTROL</small></span></Link><div className="sidebar-section">WORKSPACE</div><NavLink className="workspace-link" to="/events"><CalendarIcon />Events</NavLink><div className="sidebar-note"><span className="live-dot"/>Connected to Firebase<p>One shared source of truth for your event and players.</p></div><footer><span>{user.email}</span><small>{access.role === 'organizer' ? 'Organizer' : 'Redemption staff'}</small><button onClick={logout}><LogOut size={16}/>Sign out</button><small>{import.meta.env.VITE_FIREBASE_PROJECT_ID}<br />{import.meta.env.VITE_BUILD_COMMIT?.slice(0, 7) || 'Local build'}</small></footer></aside>
    <main className="main-content"><div className="topbar"><span>Operations workspace</span><Link to="/events"><ArrowLeft size={14}/>{location.pathname === '/events' ? 'All events' : 'Switch event'}</Link></div><Routes><Route path="/events" element={<Events />}/><Route path="/events/:eventId/*" element={<EventProvider><EventShell /></EventProvider>}/><Route path="*" element={<Navigate to={access.role === "redemption" && access.eventIds.length === 1 ? `/events/${access.eventIds[0]}/redeem` : "/events"} replace/>}/></Routes></main></div>;
}
function CalendarIcon() { return <Package size={18}/>; }
