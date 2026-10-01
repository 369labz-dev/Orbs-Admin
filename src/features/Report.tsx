import { useEffect, useRef, useState } from 'react';
import { useEvent } from '../lib/event';
import { adminCall } from '../lib/firebase';
import { useAdminQuery, PageTitle, Notice, Freshness, time, tierLabel } from '../lib/ui';
import { downloadCsv, utc } from '../lib/csv';
export function Report() {
    const { eventId } = useEvent(), query = useAdminQuery({ action: 'report', eventId });
    const [busy, setBusy] = useState(''), [error, setError] = useState<Error | null>(null), [tier, setTier] = useState(''), [category, setCategory] = useState('');
    const canceled = useRef(false);
    useEffect(() => () => { canceled.current = true; }, []);
    const report = query.data;
    const exportCsv = async (kind: string) => {
        canceled.current = false;
        setBusy(kind);
        setError(null);
        try {
            const fresh = await adminCall({ action: 'report', eventId }), e = fresh.event, s = fresh.summary;
            let columns: string[] = [], rows: unknown[][] = [];
            if (kind === 'summary') {
                columns = ['event_id', 'event_name', 'state', 'started_at_utc', 'ended_at_utc', 'generated_at_utc', 'participants_observed', 'claims', 'winners', 'points_awarded', 'issued_rewards', 'redeemed_rewards', 'outstanding_rewards'];
                rows = [[eventId, e.name, e.state, utc(e.startedAt), utc(e.endedAt), utc(fresh.asOf), s.participantsObserved ?? 'Not recorded', s.claims, s.uniqueClaimWinners, s.pointsAwarded, s.issued, s.redeemed, s.outstanding]];
            }
            else {
                const action = kind === 'claims' ? 'listClaims' : kind === 'audit' ? 'listAudit' : kind === 'inventory' ? 'listInventory' : 'listLeaderboard';
                let cursor: string | undefined, records: any[] = [];
                do {
                    if (canceled.current)
                        return;
                    const page = await adminCall({ action, eventId, limit: 200, cursor,
                        ...(kind === 'claims' || kind === 'audit' ? { asOf: fresh.asOf } : {}),
                        ...(kind === 'claims' && tier ? { tier } : {}), ...(kind === 'audit' && category ? { category } : {}) });
                    records.push(...page.items);
                    cursor = page.nextCursor || undefined;
                } while (cursor);
                if (kind === 'claims') {
                    columns = ['event_id', 'orb_id', 'claimed_at_utc', 'tier', 'winner_uid', 'winner_name', 'reward_kind', 'points_awarded', 'prize', 'redeemed', 'redeemed_at_utc'];
                    rows = records.map(r => [eventId, r.id, utc(r.claimedAt), tierLabel(r.type), r.claimedBy, r.claimedByName, r.rewardKind ?? 'reward', r.pointsAwarded ?? 0, r.prize, r.redeemed, utc(r.redeemedAt)]);
                }
                if (kind === 'leaderboard') {
                    columns = ['event_id', 'rank', 'player_uid', 'player_name', 'points', 'wins', 'first_arrivals', 'consolations'];
                    rows = records.map(r => [eventId, r.rank, r.id, r.name, r.points, r.wins ?? 0, r.firstArrivals ?? 0, r.consolations ?? 0]);
                }
                if (kind === 'inventory') {
                    columns = ['event_id', 'inventory_id', 'prize', 'available', 'reserved', 'issued', 'redeemed', 'outstanding'];
                    rows = records.map(r => [eventId, r.id, r.prize, r.remaining, r.reserved, r.issued, r.redeemed, r.outstanding]);
                    rows.push([eventId, 'untracked', 'Untracked legacy stock', '', fresh.untracked.reserved, fresh.untracked.issued, fresh.untracked.redeemed, fresh.untracked.issued - fresh.untracked.redeemed]);
                }
                if (kind === 'audit') {
                    columns = ['event_id', 'entry_id', 'timestamp_utc', 'actor_uid', 'action', 'entity_id', 'details_json'];
                    rows = records.map(r => [eventId, r.id, utc(r.ts), r.playerId, r.type, r.payload?.orbId ?? r.payload?.inventoryId ?? r.payload?.eventId ?? r.payload?.uid ?? '', JSON.stringify(r.payload)]);
                }
            }
            if (!canceled.current)
                downloadCsv(`event-${eventId}-${kind}.csv`, columns, rows);
        }
        catch (e) {
            setError(e as Error);
        }
        finally {
            setBusy('');
        }
    };
    return <><PageTitle title="Event report" description="Game results and reward fulfillment, as of the latest server snapshot."/><Freshness query={query}/><Notice error={query.error || error}/>
    {report && <><section className="panel"><div className="eyebrow">{report.event.state === 'ended' ? 'GAME ENDED · REDEMPTION STILL OPEN' : 'EVENT IN PROGRESS'}</div><h2>{report.event.name || eventId}</h2><p>Started {time(report.event.startedAt)} · Ended {time(report.event.endedAt)}</p><p>Generated {time(report.asOf)}. Late redemption updates fulfillment totals.</p><div className="metrics"><div><strong>{report.summary.participantsObserved ?? 'Not recorded'}</strong><span>Participants observed</span></div><div><strong>{report.summary.claims}</strong><span>Claims</span></div><div><strong>{report.summary.uniqueClaimWinners}</strong><span>Winners</span></div><div><strong>{report.summary.pointsAwarded}</strong><span>Points awarded</span></div></div></section>
    <section className="panel"><h2>Claims by tier</h2><div className="metrics">{report.tiers.map((t: any) => <div key={t.type}><strong>{t.claims}</strong><span>{tierLabel(t.type)}</span></div>)}</div></section>
    <section className="panel"><h2>Reward fulfillment</h2><div className="metrics"><div><strong>{report.summary.issued}</strong><span>Issued</span></div><div><strong>{report.summary.redeemed}</strong><span>Redeemed</span></div><div><strong>{report.summary.outstanding}</strong><span>Outstanding</span></div></div><div className="table-wrap"><table><thead><tr><th>Prize</th><th>Available</th><th>Reserved</th><th>Issued</th><th>Redeemed</th><th>Outstanding</th></tr></thead><tbody>{report.inventory.map((i: any) => <tr key={i.id}><td>{i.prize}</td><td>{i.remaining}</td><td>{i.reserved}</td><td>{i.issued}</td><td>{i.redeemed}</td><td>{i.outstanding}</td></tr>)}<tr><td>Untracked legacy stock</td><td>—</td><td>{report.untracked.reserved}</td><td>{report.untracked.issued}</td><td>{report.untracked.redeemed}</td><td>{report.untracked.issued - report.untracked.redeemed}</td></tr></tbody></table></div></section>
    <section className="panel"><h2>CSV exports</h2><p>All pages are included. Codes, contacts and GPS data are excluded. Active event exports reflect current data rather than an atomic snapshot.</p><div className="form-grid"><label>Claims tier<select value={tier} onChange={e => setTier(e.target.value)}><option value="">All tiers</option>{['common', 'rare', 'epic'].map(t => <option value={t} key={t}>{tierLabel(t)}</option>)}</select></label><label>Audit category<select value={category} onChange={e => setCategory(e.target.value)}><option value="">All activity</option>{['event', 'orbs', 'inventory', 'staff', 'redemption', 'gameplay'].map(c => <option key={c}>{c}</option>)}</select></label></div><div className="actions wrap">{['summary', 'claims', 'leaderboard', 'inventory', 'audit'].map(kind => <button key={kind} disabled={!!busy} onClick={() => exportCsv(kind)}>{busy === kind ? 'Exporting…' : `Export ${kind}`}</button>)}{busy && <button onClick={() => { canceled.current = true; }}>Cancel export</button>}</div></section>
    <details className="panel"><summary>Event configuration</summary><pre>{JSON.stringify({ durationMinutes: report.event.durationMinutes, bufferMeters: report.event.bufferMeters, unlock: report.event.unlock, scoring: report.event.scoring, spawning: report.event.spawning }, null, 2)}</pre></details></>}
  </>;
}
