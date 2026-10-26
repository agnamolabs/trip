// Prompt suggestions for the chat screen: a few concrete asks built from the trip,
// the time of day and the forecast. Pure functions so they can be reasoned about.
export type SuggestionIcon = 'sun' | 'rain' | 'clock' | 'pin' | 'bag' | 'camera';

export type Suggestion = {
  label: string;
  hint: string;
  query: string;
  icon: SuggestionIcon;
};

export type SuggestionInput = {
  city?: string;
  hour?: number;
  tempC?: number;
  rainChance?: number;
  stops?: { title: string; place?: string; time?: string }[];
  tripStart?: string;
  localTime?: string;
  today?: string;
  unpacked?: number;
  photoCount?: number;
};

const degree = (value: number | undefined) => (Number.isFinite(value) ? Math.round(Number(value)) : null);

export function chatSuggestions(input: SuggestionInput): Suggestion[] {
  const city = (input.city || '').trim();
  const place = city || 'the city';
  // Prefer the destination's local hour (open-meteo returns local time) over the viewer's clock.
  const localHour = Number((input.localTime || '').slice(11, 13));
  const hour = Number.isFinite(input.hour) ? Number(input.hour)
    : Number.isFinite(localHour) && (input.localTime || '').length >= 13 ? localHour
    : new Date().getHours();
  const temp = degree(input.tempC);
  const rain = Number.isFinite(input.rainChance) ? Number(input.rainChance) : null;
  const out: Suggestion[] = [];
  const add = (item: Suggestion) => {
    if (out.some(existing => existing.label === item.label)) return;
    out.push(item);
  };

  if (rain !== null && rain >= 50) {
    add({
      icon: 'rain',
      label: 'Rain is likely today',
      hint: `${rain}% chance · indoor swaps`,
      query: `Rain is likely in ${place} today. What should we do indoors instead of our saved stops?`,
    });
  }
  if (temp !== null && temp >= 27) {
    add({
      icon: 'sun',
      label: 'Beat the afternoon heat',
      hint: `About ${temp}° · shade and water`,
      query: `It is around ${temp}° in ${place}. Where can we cool off this afternoon without losing the day?`,
    });
  }
  if (hour < 11) {
    add({
      icon: 'clock',
      label: 'Plan the morning',
      hint: 'Two or three stops, before lunch',
      query: `Plan this morning in ${place} — we have until lunchtime.`,
    });
  } else if (hour < 17) {
    add({
      icon: 'clock',
      label: 'Fill the afternoon',
      hint: 'Around what is already saved',
      query: `What is the best way to spend this afternoon in ${place} around what we already saved?`,
    });
  } else {
    add({
      icon: 'sun',
      label: 'Dinner and a sunset',
      hint: 'Walkable, bookable tonight',
      query: `Where should we eat tonight in ${place}, ideally walkable to a sunset spot?`,
    });
  }

  const firstPlace = (input.stops || []).find(stop => stop.place || stop.title);
  if (firstPlace) {
    add({
      icon: 'pin',
      label: `Order the day around ${firstPlace.place || firstPlace.title}`,
      hint: 'Keep the walking short',
      query: `How should we order ${firstPlace.place || firstPlace.title} and our other stops today so we walk the least?`,
    });
  }

  if (input.tripStart && input.today && input.tripStart > input.today) {
    add({
      icon: 'bag',
      label: 'Before you fly',
      hint: 'Packing gaps and paperwork',
      query: `Our trip to ${place} starts on ${input.tripStart}. What should we sort out before we fly?`,
    });
  } else if (Number.isFinite(input.unpacked) && Number(input.unpacked) > 0) {
    add({
      icon: 'bag',
      label: `${input.unpacked} things still unpacked`,
      hint: 'What actually matters',
      query: `We still have ${input.unpacked} unpacked items for ${place}. Which of those can we leave behind?`,
    });
  }

  if (Number.isFinite(input.photoCount) && Number(input.photoCount) > 0) {
    add({
      icon: 'camera',
      label: 'Turn the photos into posts',
      hint: 'Captions from this trip',
      query: `Write three short captions for the photos we took in ${place}.`,
    });
  }

  add({
    icon: 'clock',
    label: 'Tomorrow, in one look',
    hint: 'A short plan you can edit',
    query: `Give me a short plan for tomorrow in ${place}.`,
  });

  add({
    icon: 'clock',
    label: 'What am I forgetting?',
    hint: 'Bookings, times, gaps',
    query: `Look at ${city ? 'our ' + city + ' trip' : 'our trip'} and tell me what we have not booked or planned yet.`,
  });

  return out.slice(0, 4);
}
