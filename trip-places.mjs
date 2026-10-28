// Turn provider pages into individual places. A "best restaurants" article is a page,
// not a recommendation: these parsers pull the venues out of the markdown so the UI can
// show one card per place, with that place's own photo when the page carries one.
const JUNK_HEADING = /^(most popular|the latest in|related|sign up|subscribe|advertis\w*|share|follow|about\b|more from|read more|editor'?s picks?|newsletters?|leave a comment|comments?)$/i;
const SOCIAL_LINK = /(instagram\.com|facebook\.com|twitter\.com|x\.com|tiktok\.com|youtube\.com|threads\.net|mailto:|yelp\.com\/writeareview|maps\.google|goo\.gl\/maps)/i;
const TRACKING_IMAGE = /(pixel|spacer|blank|1x1|avatar|logo|icon|sprite)/i;

export const cleanText = value => String(value || '')
  .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/[*_`>#]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const images = text => [...String(text || '').matchAll(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g)]
  .map(match => ({ alt: cleanText(match[1]), url: match[2] }))
  .filter(image => !TRACKING_IMAGE.test(image.url));

const links = text => [...String(text || '').matchAll(/\[([^\]]{2,90})\]\((https?:\/\/[^\s)]+)\)/g)]
  .map(match => ({ text: cleanText(match[1]), url: match[2] }))
  .filter(link => link.text && !SOCIAL_LINK.test(link.url));

const looksLikeName = value => value.length >= 2 && value.length <= 80 && !JUNK_HEADING.test(value) && /[a-z]/i.test(value);
// "The 38 Best Restaurants…" is an article about places, not a place.
const looksLikeArticle = value => /\b(best|top\s+\d+|guide|where to|things to do|latest|reviews?|map of|roundup)\b/i.test(value) || /\b\d{2,}\b/.test(value);

// Heading-per-venue pages (HONOLULU Magazine, Eater maps).
function fromHeadings(headings, text) {
  const places = [];
  for (let index = 0; index < headings.length; index++) {
    const heading = headings[index];
    const start = heading.index + heading[0].length;
    const end = index + 1 < headings.length ? headings[index + 1].index : text.length;
    const chunk = text.slice(start, end);
    const name = cleanText(heading[1]);
    if (!looksLikeName(name) || looksLikeArticle(name) || name.split(/\s+/).length > 6 || /[,:]/.test(name) || /\$\d/.test(name)) continue;
    const chunkImages = images(chunk);
    const named = chunkImages.find(image => image.alt && (image.alt.toLowerCase().includes(name.toLowerCase().slice(0, 12)) || name.toLowerCase().includes(image.alt.toLowerCase().slice(0, 12))));
    const detail = cleanText(chunk).slice(0, 240);
    if (!detail && !chunkImages.length) continue;
    places.push({ name, detail, image: (named || {}).url || '', url: (links(chunk)[0] || {}).url || '' });
  }
  return places;
}

// Link-wall pages: a paragraph of venue links with no headings.
function fromLinks(text) {
  const found = links(text);
  const unique = [];
  for (const link of found) {
    if (unique.some(existing => existing.name.toLowerCase() === link.text.toLowerCase())) continue;
    if (!looksLikeName(link.text) || looksLikeArticle(link.text)) continue;
    unique.push({ name: link.text, detail: '', image: '', url: link.url });
  }
  return unique.length >= 2 ? unique.slice(0, 8) : [];
}

export function parsePlaces(description, title, pageUrl) {
  const text = String(description || '');
  const headings = [...text.matchAll(/^\s*#{2,3}\s+(.+)$/gm)];
  const fromPage = headings.length >= 2 ? fromHeadings(headings, text) : [];
  let places = fromPage.length >= 2 ? fromPage : fromLinks(text);
  if (places.length < 2) {
    const parts = cleanText(text).split(/\s*[·•|]\s*/).map(part => part.trim()).filter(part => looksLikeName(part) && part.split(/\s+/).length <= 5);
    if (parts.length >= 3) places = parts.map(part => ({ name: part, detail: '', image: '', url: '' }));
  }
  const pageImage = (images(text)[0] || {}).url || '';
  if (places.length) {
    return places.slice(0, 8).map((place, index) => ({
      name: place.name,
      detail: place.detail,
      image: place.image || (index === 0 ? pageImage : ''),
      url: place.url || pageUrl,
      fromPage: title || '',
      index,
    }));
  }
  // A single venue page: the page itself is the place.
  const name = cleanText(title).replace(/\s*[|–-]\s*[^|–-]{2,40}$/, '').slice(0, 90);
  if (!name || looksLikeArticle(name)) return [];
  // A guide hub links to other guides; it is not a venue of its own.
  if (links(text).filter(link => looksLikeArticle(link.text)).length >= 2) return [];
  return [{ name, detail: cleanText(text).slice(0, 240), image: pageImage, url: pageUrl, fromPage: '', index: 0 }];
}

export const placeId = place => 'place-' + (place.url || place.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(-60);
