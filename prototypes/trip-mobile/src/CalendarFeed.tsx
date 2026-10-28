import {useEffect,useMemo,useState} from 'react';
import {PlusIcon} from '@radix-ui/react-icons';
import {apiRequest,credentials} from './integration-api';

type NearbyPlace = {
  id: string;
  name: string;
  category: string;
  indoor: boolean;
  distanceKm: number | null;
  rating?: number | null;
  reviews?: number | null;
  ratingNote?: string;
  hours: string;
  open: boolean | null;
  difficulty: string | null;
  durationMin: number;
  notable: boolean;
  listing?: boolean;
  guide?: boolean;
  sourceUrl: string;
  lat: number | null;
  lon: number | null;
};

const LABEL: Record<string, string> = {
  bar: 'Bars', cafe: 'Cafés', food: 'Food', market: 'Markets', museum: 'Museums',
  culture: 'Theatres', viewpoint: 'Viewpoints', beach: 'Beaches', park: 'Parks', trail: 'Trails',
};
const EMPTY = 'Nothing matches those filters. Widen the distance or clear Open now.';

const minutes = (value: number) => (value < 60 ? `${value} min` : `${Math.round(value / 60 * 10) / 10} hr`);

export default function CalendarFeed({tripId,date,onAdd}:{tripId:string;date:string;onAdd:(place:NearbyPlace)=>void}) {
  const [items,setItems] = useState<NearbyPlace[]>([]);
  const [source,setSource] = useState<{provider:string;listing:boolean}>({provider:'',listing:false});
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const [openOnly,setOpenOnly] = useState(true);
  const [cats,setCats] = useState<string[]>([]);
  const [withinKm,setWithinKm] = useState(8);
  const [maxMinutes,setMaxMinutes] = useState(0);
  const [difficulty,setDifficulty] = useState('');
  const [attempt,setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const token = credentials.token;
    setBusy(true); setError('');
    apiRequest<{items:NearbyPlace[];provider?:string;listing?:boolean}>(`/api/app/nearby?tripId=${encodeURIComponent(tripId)}&radius=${withinKm * 1000}`)
      .then(result => { if (active && credentials.token === token) { setItems(Array.isArray(result.items) ? result.items : []); setSource({provider:result.provider||'', listing:!!result.listing}); } })
      .catch(reason => { if (active) setError((reason as Error).message); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [tripId, withinKm, attempt]);

  const categories = useMemo(() => [...new Set(items.map(item => item.category))], [items]);

  const visible = useMemo(() => items.filter(item => {
    if (openOnly && item.open !== true) return false;
    if (cats.length && !cats.includes(item.category)) return false;
    if (item.distanceKm != null && item.distanceKm > withinKm) return false;
    if (maxMinutes && item.durationMin > maxMinutes) return false;
    if (difficulty && item.difficulty !== difficulty) return false;
    return true;
  }), [items, openOnly, cats, withinKm, maxMinutes, difficulty]);

  const labelled = visible.filter(item => item.open === true);
  const unknown = visible.filter(item => item.open === null);
  const filtersOn = openOnly || cats.length > 0 || maxMinutes > 0 || !!difficulty;
  const resetFilters = () => { setOpenOnly(false); setCats([]); setMaxMinutes(0); setDifficulty(''); setWithinKm(8); };

  const card = (item: NearbyPlace) => (
    <div className="feed-card" key={item.id}>
      <div className="feed-main">
        <div className="feed-top">
          <b>{item.name}</b>
          {item.guide ? <span className="feed-badge guide">guide</span> : item.notable && <span className="feed-badge">well known</span>}
        </div>
        <div className="feed-meta">
          <span>{LABEL[item.category] || item.category}</span>
          {item.rating != null && <><span>·</span><span className="feed-rating">★ {item.rating.toFixed(1)}{item.reviews ? ' (' + item.reviews + ')' : ''}</span></>}
          <span>·</span>
          <span>{item.distanceKm != null ? item.distanceKm + ' km' : 'distance n/a'}</span>
          <span>·</span>
          <span>{minutes(item.durationMin)}</span>
          {item.difficulty && <><span>·</span><span>{item.difficulty}</span></>}
          {item.open === true && <><span>·</span><span className="feed-open">open now</span></>}
          {item.open === null && item.hours && <><span>·</span><span>{item.hours}</span></>}
        </div>
      </div>
      <div className="feed-actions">
        {!item.guide && <button type="button" aria-label={'Add ' + item.name + ' to ' + date} onClick={() => onAdd(item)}><PlusIcon/></button>}
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

    {error && <div className="live-error"><p role="alert">{error}</p><button type="button" className="subtle" disabled={busy} onClick={() => setAttempt(value => value + 1)}>Try again</button></div>}
    {busy && !items.length && <p className="quiet">Reading OpenStreetMap around your destination…</p>}

    {labelled.length > 0 && <div className="feed-list">{labelled.slice(0, 24).map(card)}</div>}

    {unknown.length > 0 && <>
      <p className="eyebrow" style={{marginTop:16}}>HOURS NOT LISTED</p>
      <div className="feed-list feed-list-dim">{unknown.slice(0, 8).map(card)}</div>
    </>}

    {!busy && !error && (items.length
      ? (!visible.length && <div className="feed-empty"><p className="quiet">{EMPTY}</p>{filtersOn && <button type="button" className="subtle" onClick={resetFilters}>Clear filters</button>}</div>)
      : <div className="feed-empty"><p className="quiet">No places came back for this destination. Try a wider distance.</p><button type="button" className="subtle" onClick={() => setWithinKm(20)}>Widen to 20 km</button></div>)}
    {!!items.length && <p className="micro" style={{marginTop:10}}>
      {source.listing
        ? `Parsed from listing pages via ${source.provider || 'Firecrawl'} — ratings are listing scores, and distance is unknown for these. Tap + to drop one on ${date}.`
        : source.provider === 'Google Places'
          ? `Ordered by open now, then rating, then distance. Tap + to drop one on ${date}.`
          : `OpenStreetMap has no ratings, so this is ordered by open-now, notability and distance — not stars. Tap + to drop it on ${date}.`}
    </p>}
  </section>;
}
