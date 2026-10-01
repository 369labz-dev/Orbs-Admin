import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as MapType } from 'maplibre-gl';
import { TerraDraw, TerraDrawPolygonMode, TerraDrawSelectMode } from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import { polygon, featureCollection, point } from '@turf/helpers';
import area from '@turf/area';
import buffer from '@turf/buffer';
import 'maplibre-gl/dist/maplibre-gl.css';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
maplibregl.setWorkerUrl(mapWorkerUrl);
import { useEvent, type WebOrb } from '../lib/event';
import { deleteOrb } from '../lib/firebase';
import { useSession } from '../lib/session';
import { useAdminMutation, useAdminQuery, Notice, Badge, time, tierLabel } from '../lib/ui';
export function MapScreen() {
    const { eventId, event, orbs, setDirty } = useEvent(), { confirm } = useSession();
    const inventory = useAdminQuery({ action: 'listInventory', eventId, limit: 200 }), positions = useAdminQuery({ action: 'positions', eventId }, 5000), mutation = useAdminMutation(eventId);
    const host = useRef<HTMLDivElement>(null), mapRef = useRef<MapType | null>(null), drawRef = useRef<TerraDraw | null>(null);
    const [loaded, setLoaded] = useState(false), [mode, setMode] = useState<'view' | 'place' | 'move' | 'zone'>('view'), [selected, setSelected] = useState<string | null>(null), [draft, setDraft] = useState<any>(null);
    const [zone, setZone] = useState<number[][] | null>(null), [error, setError] = useState<Error | null>(null), [status, setStatus] = useState(''), [tier, setTier] = useState(''), [search, setSearch] = useState('');
    const state = useRef({ mode, selected, event, orbs });
    state.current = { mode, selected, event, orbs };
    const editable = event.state !== 'ended' && (event.endsAt == null || event.endsAt > Date.now());
    useEffect(() => { setDirty(!!draft || mode === 'zone' || mode === 'move'); return () => setDirty(false); }, [draft, mode, setDirty]);
    useEffect(() => {
        const token = import.meta.env.VITE_MAPBOX_TOKEN;
        const map = new maplibregl.Map({ container: host.current!, center: [7.1, 50.73], zoom: 14,
            style: { version: 8, sources: { base: { type: 'raster', tiles: [`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}?access_token=${token}`], tileSize: 256, attribution: '© Mapbox © OpenStreetMap' } }, layers: [{ id: 'base', type: 'raster', source: 'base' }] } });
        mapRef.current = map;
        const resize = new ResizeObserver(() => map.resize());
        resize.observe(host.current!);
        map.addControl(new maplibregl.NavigationControl(), 'top-right');
        map.on('error', () => setError(new Error('Map tiles could not load. Check the connection or map configuration. Other event tools remain available.')));
        map.on('load', () => {
            for (const id of ['zone', 'interior', 'orbs', 'players', 'preview'])
                map.addSource(id, { type: 'geojson', data: featureCollection([]) });
            map.addLayer({ id: 'zone-fill', type: 'fill', source: 'zone', paint: { 'fill-color': '#2586c2', 'fill-opacity': .08 } });
            map.addLayer({ id: 'zone-edge', type: 'line', source: 'zone', paint: { 'line-color': '#2586c2', 'line-width': 2 } });
            map.addLayer({ id: 'inside-buffer', type: 'line', source: 'interior', paint: { 'line-color': '#617b90', 'line-width': 1, 'line-dasharray': [3, 2] } });
            map.addLayer({ id: 'orbs', type: 'circle', source: 'orbs', paint: { 'circle-radius': 10, 'circle-color': ['match', ['get', 'type'], 'epic', '#9568d7', 'rare', '#de9424', '#21918d'], 'circle-stroke-color': '#fff', 'circle-stroke-width': 3, 'circle-opacity': ['match', ['get', 'status'], 'claimed', .35, 'expired', .35, 1] } });
            map.addLayer({ id: 'players', type: 'circle', source: 'players', paint: { 'circle-radius': 4, 'circle-color': '#142b45', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1 } });
            map.addLayer({ id: 'preview', type: 'circle', source: 'preview', paint: { 'circle-radius': 12, 'circle-color': '#efb635', 'circle-stroke-color': '#fff', 'circle-stroke-width': 3 } });
            const draw = new TerraDraw({ adapter: new TerraDrawMapLibreGLAdapter({ map, coordinatePrecision: 9 }), modes: [new TerraDrawPolygonMode(), new TerraDrawSelectMode({ flags: { polygon: { feature: { draggable: true, coordinates: { draggable: true, deletable: true, midpoints: true } } } } })] });
            draw.start();
            drawRef.current = draw;
            draw.on('finish', () => { draw.setMode('select'); const geometry = draw.getSnapshot().find(f => f.geometry.type === 'Polygon')?.geometry; if (geometry?.type === 'Polygon')
                setZone(geometry.coordinates[0]); });
            draw.on('change', () => { const geometry = draw.getSnapshot().find(f => f.geometry.type === 'Polygon')?.geometry; if (geometry?.type === 'Polygon')
                setZone(geometry.coordinates[0]); });
            setLoaded(true);
        });
        map.on('click', e => {
            const { mode, selected, orbs } = state.current;
            if (mode === 'zone')
                return;
            if (mode === 'place')
                setDraft({ id: crypto.randomUUID(), type: 'common', rewardKind: 'points', prize: '', radiusMeters: 12, lifetimeMinutes: 10, latitude: e.lngLat.lat, longitude: e.lngLat.lng });
            else if (mode === 'move' && selected)
                setDraft({ ...orbs.find(o => o.id === selected), latitude: e.lngLat.lat, longitude: e.lngLat.lng, moving: true });
            else {
                const feature = map.queryRenderedFeatures(e.point, { layers: ['orbs'] })[0];
                if (feature)
                    setSelected(String(feature.properties.id));
            }
        });
        return () => { resize.disconnect(); drawRef.current?.stop(); map.remove(); mapRef.current = null; drawRef.current = null; };
    }, []);
    useEffect(() => {
        if (!loaded)
            return;
        const map = mapRef.current!;
        const polygons = event.geofence.filter(r => r.points.length >= 3).map(r => { const coordinates = r.points.map(p => [p.lng, p.lat]); coordinates.push(coordinates[0]); return polygon([coordinates]); });
        (map.getSource('zone') as GeoJSONSource).setData(featureCollection(polygons));
        const interiors = polygons.map(p => event.bufferMeters > 0 ? buffer(p, -event.bufferMeters, { units: 'meters' }) : p).filter(p => p != null);
        (map.getSource('interior') as GeoJSONSource).setData(featureCollection(interiors));
        if (event.geofence[0]?.points.length) {
            const bounds = new maplibregl.LngLatBounds();
            event.geofence.forEach(r => r.points.forEach(p => bounds.extend([p.lng, p.lat])));
            map.fitBounds(bounds, { padding: 65, maxZoom: 17, duration: 0 });
        }
    }, [loaded, event.geofence]);
    const visible = orbs.filter(o => (!status || o.status === status) && (!tier || o.type === tier) && `${o.id} ${o.prize}`.toLowerCase().includes(search.toLowerCase()));
    useEffect(() => { if (loaded)
        (mapRef.current!.getSource('orbs') as GeoJSONSource).setData(featureCollection(visible.map(o => point([o.location.lng, o.location.lat], { id: o.id, type: o.type, status: o.status })))); }, [loaded, orbs, status, tier, search]);
    useEffect(() => { if (loaded)
        (mapRef.current!.getSource('players') as GeoJSONSource).setData(featureCollection((positions.data?.items ?? []).map((p: any) => point([p.lng, p.lat])))); }, [loaded, positions.data]);
    useEffect(() => { if (loaded)
        (mapRef.current!.getSource('preview') as GeoJSONSource).setData(featureCollection(draft ? [point([draft.longitude, draft.latitude])] : [])); }, [loaded, draft]);
    const orb = orbs.find(o => o.id === selected);
    const cancel = () => { setMode('view'); setDraft(null); setZone(null); drawRef.current?.clear(); drawRef.current?.setMode('static'); mutation.reset(); };
    const edit = (o: WebOrb) => { setDraft({ ...o, latitude: o.location.lat, longitude: o.location.lng, lifetimeMinutes: o.cooldownSec / 60 }); };
    return <div className="map-workspace"><div className="map-area"><div ref={host} className="map-canvas"/><div className="map-tools"><button disabled={!editable || !loaded} onClick={() => { cancel(); setSelected(null); setMode('place'); }}>Place Orb</button><button disabled={!loaded || !['waiting', 'paused'].includes(event.state) || event.geofence.length > 1} onClick={() => {
            cancel();
            setMode('zone');
            const draw = drawRef.current!;
            if (event.geofence[0]?.points.length) {
                const coordinates = event.geofence[0].points.map(p => [p.lng, p.lat]);
                coordinates.push(coordinates[0]);
                draw.addFeatures([{ type: 'Feature', id: crypto.randomUUID(), properties: { mode: 'polygon' }, geometry: { type: 'Polygon', coordinates: [coordinates] } }]);
                draw.setMode('select');
            }
            else
                draw.setMode('polygon');
        }}>Draw / edit zone</button><button onClick={() => { const map = mapRef.current; if (map && event.geofence[0]) {
        const bounds = new maplibregl.LngLatBounds();
        event.geofence.forEach(r => r.points.forEach(p => bounds.extend([p.lng, p.lat])));
        map.fitBounds(bounds, { padding: 65 });
    } }}>Fit zone</button></div><div className="map-legend"><span>● Common</span><span>● Rare</span><span>● Legendary</span><span>{positions.data?.items.length ?? 0} active players</span></div></div>
    <aside className="map-panel"><div className="eyebrow">ACTIVATION MAP</div><h2>{mode === 'zone' ? 'Edit play area' : draft ? draft.moving ? 'Move Orb' : 'Orb properties' : orb ? 'Selected Orb' : 'Orb overview'}</h2><Notice error={error || mutation.error || positions.error}/>
      {mode === 'place' && !draft && <div className="notice">Click the map to preview a new Orb.</div>}{mode === 'move' && !draft && <div className="notice">Click its new position on the map.</div>}
      {mode === 'zone' ? <><p>Click to draw corners, then click the first corner to finish. Select a polygon to adjust its points.</p>{zone && <p>{Math.round(area(polygon([zone]))).toLocaleString()} m² · {zone.length - 1} corners</p>}<p>Inside buffer: {event.bufferMeters} m. Server checks placement.</p><div className="actions"><button onClick={cancel}>Cancel</button><button className="primary" disabled={!zone || mutation.isPending} onClick={() => mutation.mutate({ action: 'saveZone', zonePoints: zone!.slice(0, -1).map(([lng, lat]) => ({ lat, lng })) }, { onSuccess: cancel })}>Save zone</button></div></> : draft ? <form onSubmit={e => { e.preventDefault(); mutation.mutate(draft.moving ? { action: 'moveOrb', orbId: draft.id, latitude: draft.latitude, longitude: draft.longitude } : { action: 'saveOrb', orbId: draft.id, create: !orbs.some(o => o.id === draft.id), type: draft.type, rewardKind: draft.rewardKind, inventoryId: draft.inventoryId || undefined, prize: draft.prize || '', prizeVisible: false, latitude: draft.latitude, longitude: draft.longitude, radiusMeters: draft.radiusMeters, lifetimeMinutes: draft.lifetimeMinutes }, { onSuccess: () => { setSelected(draft.id); cancel(); } }); }}>
        <div className="coordinate">{draft.latitude.toFixed(6)}, {draft.longitude.toFixed(6)}</div>
        {!draft.moving && <><label>Tier<select value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value })}>{['common', 'rare', 'epic'].map(t => <option value={t} key={t}>{tierLabel(t)}</option>)}</select></label><label>Contents<select value={draft.rewardKind} onChange={e => setDraft({ ...draft, rewardKind: e.target.value, inventoryId: undefined })}><option value="points">Points only</option><option value="reward">Reward + points</option></select></label>{draft.rewardKind === 'reward' && <label>Reward<select required value={draft.inventoryId ?? ''} onChange={e => { const item = inventory.data?.items.find((i: any) => i.id === e.target.value); setDraft({ ...draft, inventoryId: e.target.value, prize: item?.prize ?? draft.prize }); }}><option value="">{draft.prize ? `${draft.prize} · untracked legacy stock` : 'Select inventory item'}</option>{inventory.data?.items.map((i: any) => <option key={i.id} value={i.id}>{i.prize} · {i.remaining} available</option>)}</select></label>}<label>Interaction radius (m)<input type="number" min={1} max={200} required value={draft.radiusMeters} onChange={e => setDraft({ ...draft, radiusMeters: Number(e.target.value) })}/></label><label>Lifetime (minutes)<input type="number" min={1} max={10080} required value={draft.lifetimeMinutes} onChange={e => setDraft({ ...draft, lifetimeMinutes: Number(e.target.value) })}/></label></>}
        <div className="actions"><button type="button" onClick={cancel}>Cancel</button><button className="primary" disabled={mutation.isPending}>Save</button></div></form> : orb ? <><Badge value={orb.status}/><h3>{tierLabel(orb.type)} · {orb.prize || 'Points only'}</h3><code>{orb.id}</code><dl><dt>Expires</dt><dd>{time(orb.expiresAt)}</dd><dt>Source</dt><dd>{orb.autoSpawned ? 'Automatic' : 'Manual'}</dd><dt>Stock</dt><dd>{orb.inventoryId || 'Untracked / points'}</dd><dt>Position</dt><dd>{orb.location.lat.toFixed(6)}, {orb.location.lng.toFixed(6)}</dd></dl><div className="actions wrap"><button disabled={!editable || orb.status === 'claimed'} onClick={() => edit(orb)}>Properties</button><button disabled={!editable || orb.status === 'claimed'} onClick={() => setMode('move')}>Move</button>{orb.status === 'expired' && <button disabled={!editable || mutation.isPending} onClick={() => mutation.mutate({ action: 'saveOrb', orbId: orb.id, reactivate: true, type: orb.type, rewardKind: orb.rewardKind ?? 'reward', inventoryId: orb.inventoryId, prize: orb.prize, prizeVisible: false, latitude: orb.location.lat, longitude: orb.location.lng, radiusMeters: orb.radiusMeters, lifetimeMinutes: orb.cooldownSec / 60 })}>Activate</button>}<button className="danger" disabled={!editable || orb.status === 'claimed' || mutation.isPending} onClick={async () => { if (await confirm(`Delete unclaimed Orb ${orb.id}?`))
            try {
                await deleteOrb(eventId, orb.id);
                setSelected(null);
            }
            catch (e) {
                setError(e as Error);
            } }}>Delete</button></div><button className="text-button" onClick={() => setSelected(null)}>Back to Orb list</button></> : <>
        <label>Search<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Prize or Orb ID"/></label><div className="form-grid"><label>Status<select value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option>{['available', 'locked', 'claimed', 'expired'].map(s => <option key={s}>{s}</option>)}</select></label><label>Tier<select value={tier} onChange={e => setTier(e.target.value)}><option value="">All tiers</option>{['common', 'rare', 'epic'].map(t => <option key={t} value={t}>{tierLabel(t)}</option>)}</select></label></div><div className="orb-list">{visible.map(o => <button key={o.id} onClick={() => { setSelected(o.id); mapRef.current?.flyTo({ center: [o.location.lng, o.location.lat], zoom: 17 }); }}><span><strong>{o.prize || 'Points only'}</strong><small>{tierLabel(o.type)}</small></span><Badge value={o.status}/></button>)}</div>{!visible.length && <p>No Orbs match this view.</p>}
      </>}
      <div className="mobile-map-note">Use a tablet or desktop to edit map geometry.</div>
      {event.geofence.length > 1 && <p>Multiple zones are shown read-only. This editor supports one polygon.</p>}
    </aside></div>;
}
