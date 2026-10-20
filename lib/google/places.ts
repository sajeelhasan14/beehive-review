import 'server-only';

// "Find on Google" in Add client: business name -> matching Google listings -> their review link.
// Uses Places API (New) Text Search from the server, so the key never reaches the browser.
// Off until GOOGLE_MAPS_API_KEY is set (a key with "Places API (New)" enabled).

export interface GooglePlace {
  id: string;
  name: string;
  address: string;
  reviewLink: string;
}

export function placesEnabled(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY?.trim());
}

// Google's own "write a review" link for a place.
export function reviewLinkFor(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}

export async function searchPlaces(query: string): Promise<GooglePlace[]> {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key) throw new Error('Google search is not set up.');

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    signal: AbortSignal.timeout(8000),
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      // Only the three fields we show: keeps the request on the cheapest tier that has names.
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress',
    },
    body: JSON.stringify({ textQuery: query, pageSize: 5 }),
  });
  if (!res.ok) {
    console.error('Places search failed:', res.status, (await res.text()).slice(0, 300));
    throw new Error(res.status === 403 ? 'Google refused the search. Check the API key has Places API (New) turned on.' : 'Google search failed. Try again.');
  }

  const body = (await res.json()) as { places?: { id: string; displayName?: { text?: string }; formattedAddress?: string }[] };
  return (body.places ?? []).map((p) => ({
    id: p.id,
    name: p.displayName?.text ?? 'Unnamed place',
    address: p.formattedAddress ?? '',
    reviewLink: reviewLinkFor(p.id),
  }));
}
