import { useState } from 'react';
import { useEvent } from '../lib/event';
import { useAdminMutation, useAdminQuery, Notice, PageTitle, Freshness, Empty } from '../lib/ui';
export function Inventory() {
    const { eventId, setDirty } = useEvent(), query = useAdminQuery({ action: 'listInventory', eventId, limit: 200 }, 15000), mutation = useAdminMutation(eventId);
    const [editing, setEditing] = useState<any>(null), [previous, setPrevious] = useState<any[]>([]), [cursor, setCursor] = useState<string>();
    const pages = useAdminQuery({ action: 'listInventory', eventId, limit: 200, cursor }, 15000);
    const items = cursor ? [...previous, ...(pages.data?.items ?? [])] : query.data?.items ?? [];
    const open = (item: any) => { setEditing(item); setDirty(true); };
    const close = () => { setEditing(null); setDirty(false); };
    return <><PageTitle title="Reward inventory" description="Available stock excludes prizes already reserved for Orbs."><button className="primary" onClick={() => open({ id: crypto.randomUUID(), prize: '', remaining: 0, create: true })}>Add reward</button></PageTitle><Freshness query={query}/><Notice error={query.error || pages.error || mutation.error}/>
    {editing && <section className="panel"><h2>{editing.create ? 'New reward' : 'Adjust available stock'}</h2><form onSubmit={async (e) => { e.preventDefault(); const data = new FormData(e.currentTarget); await mutation.mutateAsync({ action: 'saveInventory', inventoryId: editing.id, prize: String(data.get('prize')), quantity: Number(data.get('quantity')), create: editing.create || undefined, expectedRemaining: editing.create ? undefined : editing.remaining }).then(close).catch(() => { }); }}><div className="form-grid"><label>Prize<input name="prize" defaultValue={editing.prize} required maxLength={200}/></label><label>Available units<input name="quantity" type="number" min={0} max={100000} step={1} defaultValue={editing.remaining} required/></label></div><p>Renaming affects future Orbs. Existing prizes stay unchanged.</p><div className="actions"><button type="button" onClick={close}>Cancel</button><button className="primary" disabled={mutation.isPending}>Save stock</button></div></form></section>}
    <div className="table-wrap"><table><thead><tr><th>Prize</th><th>Available</th><th>Reserved</th><th>Issued</th><th>Redeemed</th><th>Outstanding</th><th /></tr></thead><tbody>{items.map((i: any) => <tr key={i.id}><td><strong>{i.prize}</strong><small>{i.id}</small></td><td>{i.remaining}</td><td>{i.reserved}</td><td>{i.issued}</td><td>{i.redeemed}</td><td>{i.outstanding}</td><td><button onClick={() => open(i)}>Adjust</button></td></tr>)}</tbody></table></div>
    {!query.isPending && !items.length && <Empty>Add rewards before placing prize Orbs.</Empty>}
    {(cursor ? pages.data : query.data)?.nextCursor && <button onClick={() => { setPrevious(items); setCursor((cursor ? pages.data : query.data).nextCursor); }}>Load more</button>}
  </>;
}
