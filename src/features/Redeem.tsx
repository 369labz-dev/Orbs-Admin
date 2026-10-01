import { useState } from 'react';
import { CheckCircle2, TicketCheck } from 'lucide-react';
import { useEvent } from '../lib/event';
import { useSession } from '../lib/session';
import { useAdminMutation, Notice, PageTitle, time } from '../lib/ui';
export function Redeem() {
    const { eventId, event } = useEvent(), { confirm } = useSession(), mutation = useAdminMutation(eventId);
    const [code, setCode] = useState(''), [checked, setChecked] = useState<any>(null), [receipt, setReceipt] = useState<any>(null), [error, setError] = useState<Error | null>(null);
    return <><PageTitle title="Redeem a reward" description="Check the code. Confirm the prize. Complete the handover."/>
    <section className="panel redeem-panel"><TicketCheck size={32}/><div className="eyebrow">{event.name ?? eventId}</div>
      <Notice error={error || mutation.error}/>{receipt ? <div className="receipt"><CheckCircle2 size={48}/><h2>Redeemed successfully</h2><h3>{receipt.prize}</h3><code>{receipt.code}</code><p>{time(receipt.usedAt)}</p><button className="primary" onClick={() => { setReceipt(null); setCode(''); setChecked(null); mutation.reset(); setError(null); }}>Check another code</button></div> : <>
      <form onSubmit={async (e) => { e.preventDefault(); setError(null); setChecked(null); try {
            setChecked(await mutation.mutateAsync({ action: 'checkCode', code }));
        }
        catch (e: any) {
            if (e.details?.rejection === 'CODE_ALREADY_USED')
                setChecked({ ...e.details, used: true });
        } }}>
        <label>Redemption code<input className="code-input" value={code} onChange={e => { setCode(e.target.value); setChecked(null); mutation.reset(); setError(null); }} autoComplete="off" autoCapitalize="characters" spellCheck={false} required maxLength={100} placeholder="ORBS-…" disabled={mutation.isPending}/></label>
        <button className="primary full" disabled={mutation.isPending}>{mutation.isPending ? 'Checking…' : 'Check code'}</button>
      </form>{checked && <div className="checked-reward"><span className={`badge ${checked.used ? 'ended' : 'active'}`}>{checked.used ? 'Already redeemed' : 'Valid · not redeemed'}</span><h2>{checked.prize}</h2>{checked.used ? <p>Used {time(checked.usedAt)}. Do not hand over another prize.</p> : <><p>Only confirm when you are handing this prize to the winner.</p><button className="primary full" disabled={mutation.isPending} onClick={async () => {
                        if (!await confirm(`Hand over “${checked.prize}” and permanently redeem this code?`))
                            return;
                        try {
                            setReceipt(await mutation.mutateAsync({ action: 'redeemCode', code: checked.code }));
                        }
                        catch (e) {
                            setError(e as Error);
                            setChecked(null);
                        }
                    }}>{mutation.isPending ? 'Redeeming…' : 'Redeem prize'}</button></>}</div>}
      </>}
    </section><p className="muted">Codes remain redeemable after the event ends. Each code can be used once.</p></>;
}
