import {useEffect,useMemo,useState} from 'react';
import {ExternalLinkIcon,PlusIcon} from '@radix-ui/react-icons';
import {apiRequest,credentials} from './integration-api';

type NearbyPlace = {
  id: string;
  name: string;
  category: string;
  indoor: boolean;
  distanceKm: number;
  hours: string;
  open: boolean | null;
  difficulty: string | null;
  durationMin: number;
  notable: boolean;
  sourceUrl: string;
  lat: number;
  lon: number;
};

const LABEL: Record<string, string> = {
  bar: 'Bars', cafe: 'Cafés', food: 'Food', market: 'Markets', museum: 'Museums',
  culture: 'Theatres', viewpoint: 'Viewpoints', beach: 'Beaches', park: 'Parks', trail: 'Trails',
};
const EMPTY = 'Nothing matches those filters. Widen the distance or clear Open now.';

const minutes = (value: number) => (value < 60 ? `${value} min` : `${Math.round(value / 60 * 10) / 10} hr`);

export default function CalendarFeed({tripId,date,onAdd}:{tripId:string;date:string;onAdd:(place:NearbyPlace)=>void}) {
  const [items,setItems] = useState<NearbyPlace[]>([]);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const [openOnly,setOpenOnly] = useState(true);
  const [cats,setCats] = useState<string[]>([]);
  const [withinKm,setWithinKm] = useState(8);
  const [maxMinutes,setMaxMinutes] = useState(0);
  const [difficulty,setDifficulty] = useState('');

  useEffect(() => {
    let active = true;
    const token = credentials.token;
    setBusy(true); setError('');
    apiRequest<{items:NearbyPlace[]}>(`/api/app/nearby?tripId=${encodeURIComponent(tripId)}&radius=${withinKm * 1000}`)
      .then(result => { if (active && credentials.token === token) setItems(Array.isArray(result.items) ? result.items : []); })
      .catch(reason => { if (active) setError((reason as Error).message); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [tripId, withinKm]);

  const categories = useMemo(() => [...new Set(items.map(item => item.category))], [items]);

  const visible = useMemo(() => items.filter(item => {
    if (openOnly && item.open !== true) return false;
    if (cats.length && !cats.includes(item.category)) return false;
    if (item.distanceKm > withinKm) return false;
    if (maxMinutes && item.durationMin > maxMinutes) return false;
    if (difficulty && item.difficulty !== difficulty) return false;
    return true;
  }), [items, openOnly, cats, withinKm, maxMinutes, difficulty]);

  const labelled = visible.filter(item => item.open === true);
  const unknown = visible.filter(item => item.open === null);

  const card = (item: NearbyPlace) => (
    <div className="feed-card" key={item.id}>
      <div className="feed-main">
        <div className="feed-top">
          <b>{item.name}</b>
          {item.notable && <span className="feed-badge">well known</span>}
        </div>
        <div className="feed-meta">
          <span>{LABEL[item.category] || item.category}</span>
          <span>·</span>
          <span>{item.distanceKm} km</span>
          <span>·</span>
          <span>{minutes(item.durationMin)}</span>
          {item.difficulty && <><span>·</span><span>{item.difficulty}</span></>}
          {item.open === true && <><span>·</span><span className="feed-open">open now</span></>}
          {item.open === null && item.hours && <><span>·</span><span>{item.hours}</span></>}
        </div>
      </div>
      <div className="feed-actions">
        <button type="button" aria-label={'Add ' + item.name + ' to ' + date} onClick={() => onAdd(item)}><PlusIcon/></button>
      </div>
    </div>
  );

  return <section className="feed">
    <div className="section-top" style={{marginTop:18}}>
      <p className="eyebrow">OPEN NEAR YOU</p>
      <span className="micro">{busy ? 'Looking up…' : `${visible.length} of ${items.length}`}</span>
    </div>

    <div className="feed-filters">
      <button type="button" className={'chip' + (openOnly ? ' on' : '')} aria-pressed={openOnly} onClick={() => setOpenOnly(value => !value)}>Open now</button>
      {categories.map(key => <button type="button" key={key} className={'chip' + (cats.includes(key) ? ' on' : '')}
        aria-pressed={cats.includes(key)}
        onClick={() => setCats(current => current.includes(key) ? current.filter(value => value !== key) : [...current, key])}>{LABEL[key] || key}</button>)}
    </div>

    <div className="feed-filters feed-filters-row">
      <label className="field feed-select">Within
        <select aria-label="Distance" value={withinKm} onChange={event => setWithinKm(Number(event.target.value))}>
          {[2,5,8,12,20].map(km => <option key={km} value={km}>{km} km</option>)}
        </select>
      </label>
      <label className="field feed-select">Lasts
        <select aria-label="Duration" value={maxMinutes} onChange={event => setMaxMinutes(Number(event.target.value))}>
          <option value={0}>Any</option>
          <option value={45}>Under 45 min</option>
          <option value={90}>Under 1.5 hr</option>
          <option value={150}>Under 2.5 hr</option>
        </select>
      </label>
      <label className="field feed-select">Trail level
        <select aria-label="Difficulty" value={difficulty} onChange={event => setDifficulty(event.target.value)}>
          <option value="">Any</option>
          <option value="easy">Easy</option>
          <option value="moderate">Moderate</option>
          <option value="hard">Hard</option>
        </select>
      </label>
    </div>

    {error && <p role="alert" className="live-error">{error}</p>}
    {busy && !items.length && <p className="quiet">Reading OpenStreetMap around your destination…</p>}

    {labelled.length > 0 && <div className="feed-list">{labelled.slice(0, 24).map(card)}</div>}

    {unknown.length > 0 && <>
      <p className="eyebrow" style={{marginTop:16}}>HOURS NOT LISTED</p>
      <div className="feed-list feed-list-dim">{unknown.slice(0, 8).map(card)}</div>
    </>}

    {!busy && !error && !visible.length && <p className="quiet">{EMPTY}</p>}
    <p className="micro" style={{marginTop:10}}>
      OpenStreetMap has no ratings, so this is ordered by open-now, notability and distance — not stars. Tap + to drop it on {date}.
    </p>
  </section>;
}
