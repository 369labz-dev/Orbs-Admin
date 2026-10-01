import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useEvent } from '../lib/event';
import { useAdminMutation, useAdminQuery, Notice, PageTitle } from '../lib/ui';
const fields: [
    string,
    string,
    number,
    number,
    number
][] = [
    ['durationMinutes', 'Duration (minutes)', 1, 1440, 1], ['bufferMeters', 'Inside GPS buffer (m)', 0, 100, 1], ['lockWindowSec', 'Attempt window (s)', 5, 120, 1],
    ['firstWarningMinutes', 'First warning (minutes left)', 0, 1440, 1], ['lastWarningMinutes', 'Last warning (minutes left)', 0, 1440, 1],
    ['holdSeconds', 'Unlock hold (s)', 0.5, 119, 0.1], ['frameRadiusFraction', 'Aiming frame fraction', 0.05, 0.45, 0.01], ['recoverySeconds', 'Recovery (s)', 0, 5, 0.1],
    ['commonPoints', 'Common points', 0, 1000000, 1], ['rarePoints', 'Rare points', 0, 1000000, 1], ['epicPoints', 'Legendary points', 0, 1000000, 1], ['firstArrivalPoints', 'First arrival points', 0, 1000000, 1], ['consolationPoints', 'Consolation points', 0, 1000000, 1],
];
const spawnFields: [
    string,
    string,
    number,
    number,
    number
][] = [
    ['maxLive', 'Maximum live Orbs', 1, 100, 1], ['totalClaims', 'Total claim budget', 1, 100000, 1], ['expectedPlayers', 'Expected players', 1, 10000, 1],
    ['rewardFraction', 'Reward fraction (0–1)', 0, 1, 0.01], ['rareFrequency', 'Rare frequency (0–1)', 0, 1, 0.01], ['legendaryFrequency', 'Legendary frequency (0–1)', 0, 1, 0.01],
    ['commonLifetimeSeconds', 'Common lifetime (s)', 60, 86400, 1], ['rareLifetimeSeconds', 'Rare lifetime (s)', 60, 86400, 1], ['legendaryLifetimeSeconds', 'Legendary lifetime (s)', 60, 86400, 1], ['relocationDelaySeconds', 'Relocation delay (s)', 0, 3600, 1],
    ['entryRadiusMeters', 'Entry radius (m)', 1, 200, 1], ['exitRadiusMeters', 'Exit radius (m)', 2, 300, 1], ['searchAreaRadiusMeters', 'Search area radius (m)', 1, 300, 1],
];
export function Settings() {
    const { event, eventId, setDirty } = useEvent(), mutation = useAdminMutation(eventId), stock = useAdminQuery({ action: 'listInventory', eventId, limit: 200 });
    const defaults = { name: event.name ?? eventId, durationMinutes: event.durationMinutes ?? 60, bufferMeters: event.bufferMeters, lockWindowSec: event.lockWindowSec,
        firstWarningMinutes: event.warningMinutes?.first ?? 5, lastWarningMinutes: event.warningMinutes?.last ?? 1,
        holdSeconds: event.unlock?.holdSeconds ?? 3, frameRadiusFraction: event.unlock?.frameRadiusFraction ?? .18, recoverySeconds: event.unlock?.recoverySeconds ?? .75,
        commonPoints: event.scoring?.common ?? 0, rarePoints: event.scoring?.rare ?? 0, epicPoints: event.scoring?.epic ?? 0, consolationPoints: event.scoring?.consolation ?? 0, firstArrivalPoints: event.scoring?.firstArrival ?? 0,
        spawning: event.spawning ?? { enabled: false, maxLive: 8, totalClaims: 100, expectedPlayers: 50, rewardFraction: .5, rareFrequency: .2, legendaryFrequency: .05, commonLifetimeSeconds: 600, rareLifetimeSeconds: 900, legendaryLifetimeSeconds: 1200, relocationDelaySeconds: 30, entryRadiusMeters: 12, exitRadiusMeters: 18, searchAreaRadiusMeters: 35 } };
    const { register, handleSubmit, watch, reset, formState: { isDirty, errors } } = useForm<any>({ defaultValues: defaults });
    useEffect(() => { setDirty(isDirty); return () => setDirty(false); }, [isDirty, setDirty]);
    const values = watch(), editable = ['waiting', 'paused'].includes(event.state);
    const free = stock.data?.items.reduce((n: number, i: any) => n + i.remaining, 0) ?? 0;
    const demand = Math.ceil((values.spawning?.totalClaims ?? 0) * (values.spawning?.rewardFraction ?? 0));
    return <><PageTitle title="Event settings" description="Tune the activation. Changes apply to new attempts and new Orbs."/>
    {!editable && <div className="notice">{event.state === 'ended' ? 'This event has ended. Copy its settings to run another activation.' : 'Pause the event to edit gameplay settings. The event clock continues while paused.'}</div>}
    <Notice error={mutation.error}/><form onSubmit={handleSubmit(async (data) => { await mutation.mutateAsync({ action: 'event', ...data }).then(() => reset(data)).catch(() => { }); })}>
      <fieldset disabled={!editable || mutation.isPending}><section className="panel"><h2>Activation</h2><label>Event name<input maxLength={120} {...register('name', { required: true })}/></label><div className="form-grid">{fields.slice(0, 5).map(([key, label, min, max, step]) => <label key={key}>{label}<input type="number" min={min} max={max} step={step} {...register(key, { required: true, valueAsNumber: true })}/></label>)}</div></section>
      <section className="panel"><h2>Unlock & scoring</h2><div className="form-grid">{fields.slice(5).map(([key, label, min, max, step]) => <label key={key}>{label}<input type="number" min={min} max={max} step={step} {...register(key, { required: true, valueAsNumber: true })}/></label>)}</div></section>
      <section className="panel"><h2>Automatic spawning</h2><label className="checkbox"><input type="checkbox" {...register('spawning.enabled')}/>Enable automatic spawning</label><div className="form-grid">{spawnFields.map(([key, label, min, max, step]) => <label key={key}>{label}<input type="number" min={min} max={max} step={step} {...register(`spawning.${key}`, { required: true, valueAsNumber: true })}/></label>)}</div></section></fieldset>
      <section className="panel planning"><h2>Planning preview</h2><div className="metrics"><div><strong>{((values.spawning?.totalClaims ?? 0) / (values.spawning?.expectedPlayers || 1)).toFixed(1)}</strong><span>Claims / expected player</span></div><div><strong>{((values.spawning?.totalClaims ?? 0) / (values.durationMinutes || 1)).toFixed(1)}</strong><span>Target claims / minute</span></div><div><strong>{demand}</strong><span>Estimated reward demand</span></div><div><strong>{free}</strong><span>Available reward stock</span></div></div><p>These are planning estimates. Player count does not automatically change spawn limits. When stock runs out, new Orbs contain points. Vacancies refill on the server's one-minute lifecycle.</p></section>
      {Object.keys(errors).length > 0 && <div className="notice error">Complete all required settings.</div>}
      <div className="sticky-actions"><button type="button" onClick={() => reset(defaults)}>Discard changes</button><button className="primary" disabled={!editable || mutation.isPending || !isDirty}>{mutation.isPending ? 'Saving…' : 'Save settings'}</button></div>
    </form></>;
}
