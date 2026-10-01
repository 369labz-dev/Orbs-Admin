import { useState } from 'react';
import { useEvent } from '../lib/event';
import { useSession } from '../lib/session';
import { useAdminMutation, useAdminQuery, Notice, PageTitle, Empty } from '../lib/ui';
export function Staff() {
    const { eventId } = useEvent(), { confirm } = useSession(), query = useAdminQuery({ action: 'listStaff', eventId }), mutation = useAdminMutation(eventId);
    const [account, setAccount] = useState(''), [kind, setKind] = useState('email');
    return <><PageTitle title="Redemption staff" description="Assigned staff can check and redeem codes for this event only."/>
    <Notice error={query.error || mutation.error}/><section className="panel"><h2>Assign an existing account</h2><p>Create new email/password accounts in Firebase Auth first. Organizer access remains managed by the server allowlist.</p><form onSubmit={async (e) => { e.preventDefault(); await mutation.mutateAsync({ action: 'assignStaff', [kind]: account }).then(() => setAccount('')).catch(() => { }); }}><div className="form-grid"><label>Identify by<select value={kind} onChange={e => setKind(e.target.value)}><option value="email">Account email</option><option value="uid">Firebase UID</option></select></label><label>{kind === 'email' ? 'Email' : 'UID'}<input type={kind === 'email' ? 'email' : 'text'} value={account} onChange={e => setAccount(e.target.value)} required/></label></div><button className="primary" disabled={mutation.isPending}>Assign event access</button></form></section>
    <div className="table-wrap"><table><thead><tr><th>Account</th><th>Role</th><th /></tr></thead><tbody>{query.data?.items.map((s: any) => <tr key={s.uid}><td><strong>{s.email}</strong><small>{s.uid}</small></td><td>Redemption staff</td><td><button className="danger" disabled={mutation.isPending} onClick={async () => { if (await confirm(`Remove ${s.email}'s access to this event?`))
        mutation.mutate({ action: 'removeStaff', uid: s.uid }); }}>Remove access</button></td></tr>)}</tbody></table></div>
    {!query.isPending && !query.data?.items.length && <Empty>No redemption staff assigned. Organizers can redeem codes directly.</Empty>}
  </>;
}
