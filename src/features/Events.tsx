import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, ArrowUpRight, Copy, CalendarDays } from 'lucide-react';
import { useAdminQuery, useAdminMutation, PageTitle, Badge, Notice, Empty, time } from '../lib/ui';
import { useSession } from '../lib/session';
export function Events() {
    const { access } = useSession(), navigate = useNavigate();
    const [filter, setFilter] = useState(''), [search, setSearch] = useState(''), [cursor, setCursor] = useState<string>();
    const [rows, setRows] = useState<any[]>([]), [creating, setCreating] = useState<string | null>(null), [name, setName] = useState('');
    const [draftId, setDraftId] = useState('');
    const query = useAdminQuery({ action: 'listEvents', state: filter || undefined, cursor });
    const mutation = useAdminMutation();
    const organizer = access?.role === 'organizer';
    const items = [...rows, ...(query.data?.items ?? [])].filter(e => `${e.name} ${e.id}`.toLowerCase().includes(search.toLowerCase()));
    const open = (source: string) => { setCreating(source); setName(''); setDraftId(crypto.randomUUID()); };
    return <><PageTitle title="Your events" description="Prepare an activation. Follow it live. Review the results.">{organizer && <button className="primary" onClick={() => open('')}><Plus size={18}/>Create event</button>}</PageTitle>
    <div className="toolbar"><label className="search">Search<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Event name or ID"/></label>{organizer && <label>State<select value={filter} onChange={e => { setFilter(e.target.value); setCursor(undefined); setRows([]); }}><option value="">All states</option>{['waiting', 'active', 'paused', 'ended'].map(s => <option key={s}>{s}</option>)}</select></label>}</div>
    <Notice error={query.error || mutation.error}/>
    {creating !== null && <section className="panel"><h2>{creating ? 'Copy event configuration' : 'New activation'}</h2><p>{creating ? 'Only settings and zone are copied. Stock, rewards and access start empty.' : 'The event starts waiting. Draw its zone and configure it before launch.'}</p><form onSubmit={e => { e.preventDefault(); mutation.mutate({ action: creating ? 'copyEvent' : 'createEvent', eventId: draftId, sourceEventId: creating || undefined, name }, { onSuccess: () => { setCreating(null); navigate(`/events/${draftId}/map`); } }); }}><label>Event name<input value={name} onChange={e => setName(e.target.value)} required maxLength={120}/></label><div className="actions"><button type="button" onClick={() => setCreating(null)}>Cancel</button><button className="primary" disabled={mutation.isPending}>Create</button></div></form></section>}
    <div className="event-grid">{items.map(event => <article className="event-card" key={event.id}><div className="card-top"><CalendarDays size={22}/><Badge value={event.state}/></div><h2>{event.name}</h2><code>{event.id}</code><p>{event.startedAt ? `Started ${time(event.startedAt)}` : 'Ready when you are'}</p><div className="actions"><Link className="button primary" to={`/events/${event.id}/${organizer ? 'map' : 'redeem'}`}>Open event<ArrowUpRight size={16}/></Link>{organizer && <button aria-label={`Copy ${event.name}`} onClick={() => open(event.id)}><Copy size={16}/></button>}</div></article>)}</div>
    {!query.isPending && !items.length && <Empty>No events yet. Create your first activation.</Empty>}{query.isPending && <p>Loading events…</p>}
    {query.data?.nextCursor && <button onClick={() => { setRows([...rows, ...query.data.items]); setCursor(query.data.nextCursor); }}>Load more</button>}
  </>;
}
