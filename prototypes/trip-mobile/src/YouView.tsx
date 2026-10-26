import {Share1Icon,GearIcon,ArrowRightIcon,PaperPlaneIcon,CheckIcon} from '@radix-ui/react-icons';
import type {LegacyTrip,TripUi,LiveWeather} from './live-trip';

const dayMs = 86400000;
const parse = (value?: string) => (value ? Date.parse(value + 'T00:00:00') : NaN);

function stat(label: string, value: string, hint?: string) {
  return {label, value, hint};
}

export default function YouView({city,trip,data,weather,canEdit,onShare,onSettings,onNavigate}:{
  city: string;
  trip: LegacyTrip;
  data: TripUi;
  weather: LiveWeather | null;
  canEdit: boolean;
  onShare: () => void;
  onSettings: () => void;
  onNavigate: (page: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const start = parse(trip.depart);
  const end = parse(trip.return_date);
  const total = Number.isFinite(start) && Number.isFinite(end) ? Math.max(1, Math.round((end - start) / dayMs) + 1) : 0;
  const now = parse(today);
  const dayNumber = Number.isFinite(start) && Number.isFinite(now) ? Math.min(total || 99, Math.max(1, Math.round((now - start) / dayMs) + 1)) : 0;
  const unpacked = data.items.filter(item => !Object.values(item.packed || {}).some(Boolean));
  const totalItems = data.items.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const packedItems = data.items.reduce((sum, item) => sum + Object.values(item.packed || {}).filter(Boolean).length, 0);
  const booking = data.bookings[0];
  const temp = weather?.current?.temperature_2m;
  const stopsWithoutPlace = data.stops.filter(stop => !stop.place).length;
  const stopsWithoutDay = data.stops.filter(stop => !stop.date).length;

  const cards = [
    stat('Activities saved', String(data.stops.length), data.stops.length ? 'across the trip' : 'nothing planned yet'),
    stat('Packing', totalItems ? `${packedItems}/${totalItems}` : '—', unpacked.length ? `${unpacked.length} left` : 'complete'),
    stat('Post drafts', String(data.posts?.length || 0), data.posts?.length ? 'ready to edit' : 'from the photo roll'),
    stat('Travelers', String(data.members.length || 1), canEdit ? 'you can invite' : 'shared with you'),
  ];

  const warnings: string[] = [];
  if (unpacked.length) warnings.push(`${unpacked.length} packing ${unpacked.length === 1 ? 'item' : 'items'} still unchecked`);
  if (!booking) warnings.push('No flight or stay saved yet');
  if (stopsWithoutDay) warnings.push(`${stopsWithoutDay} ${stopsWithoutDay === 1 ? 'activity has' : 'activities have'} no day yet`);
  if (stopsWithoutPlace) warnings.push(`${stopsWithoutPlace} ${stopsWithoutPlace === 1 ? 'stop has' : 'stops have'} no address, so the map guesses`);

  return <>
    <p className="eyebrow">YOU</p>
    <div className="page-title"><h1>{city || 'Your trip'}.</h1><button className="text-btn" aria-label="Settings" onClick={onSettings}><GearIcon/> Settings</button></div>
    <p className="quiet" style={{marginTop: -6}}>
      {total ? `Day ${dayNumber} of ${total}` : 'Dates not set'} · {data.members.length || 1} traveler{(data.members.length || 1) === 1 ? '' : 's'}
      {Number.isFinite(Number(temp)) ? ` · ${Math.round(Number(temp))}° now` : ''}
    </p>

    <div className="you-grid">
      {cards.map(card => (
        <div className="you-stat" key={card.label}>
          <b>{card.value}</b>
          <small>{card.label}</small>
          <span>{card.hint}</span>
        </div>
      ))}
    </div>

    {booking && <button className="you-flight" onClick={() => onNavigate('Travel')}>
      <span className="you-flight-badge"><PaperPlaneIcon/></span>
      <span style={{flex: 1, minWidth: 0, textAlign: 'left'}}>
        <b>{booking.route || 'Travel booking'}</b>
        <small>{[booking.flight, booking.date, booking.time, booking.bookingRef && 'conf. ' + booking.bookingRef].filter(Boolean).join(' · ')}</small>
      </span>
      <ArrowRightIcon/>
    </button>}

    {!!warnings.length && <section className="you-warn">
      <p className="eyebrow">WORTH FIXING</p>
      {warnings.map(line => <div className="you-warn-row" key={line}><span aria-hidden="true">!</span><p>{line}</p></div>)}
    </section>}

    <section className="you-links">
      <p className="eyebrow">TRIP</p>
      <button onClick={() => onNavigate('Notes')}><span>Notes and confirmations</span><small>{data.pages.length}/30 saved</small><ArrowRightIcon/></button>
      <button onClick={() => onNavigate('Weather')}><span>Weather</span><small>{weather ? 'forecast loaded' : 'unavailable'}</small><ArrowRightIcon/></button>
      <button onClick={onShare} disabled={!canEdit}><span>Share this trip</span><small>{data.members.length || 1} {(data.members.length || 1) === 1 ? 'member' : 'members'}</small><Share1Icon/></button>
      <button onClick={onSettings}><span>Keys, accounts and prompts</span><small>owner only</small><GearIcon/></button>
    </section>

    <p className="micro" style={{marginTop: 18, display: 'flex', gap: 6, alignItems: 'center'}}><CheckIcon/> Nothing here is shared publicly.</p>
  </>;
}
