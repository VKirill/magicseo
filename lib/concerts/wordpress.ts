export type Concert = {
  id: number;
  status: string;
  link: string;
  city: string; // meta.gorod
  cityIn: string; // meta.v_gorode
  date: string; // meta.data_kontserta, YYYY-MM-DD
  time: string; // meta.vremia_kontserta, HH:MM city local
  soldOut: boolean;
  postponedTo: string | null;
  modifiedGmt: string;
};

type WpMeta = {
  gorod?: unknown;
  v_gorode?: unknown;
  data_kontserta?: unknown;
  vremia_kontserta?: unknown;
  sold_out?: unknown;
  perenos_kontserta?: unknown;
};

type WpPost = {
  id: number;
  status: string;
  link: string;
  modified_gmt: string;
  meta?: WpMeta;
};

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function toConcert(p: WpPost): Concert {
  const meta = p.meta ?? {};
  const soldOut = meta.sold_out === true || meta.sold_out === 'true' || meta.sold_out === '1' || meta.sold_out === 1;
  const postponedTo = str(meta.perenos_kontserta);
  return {
    id: p.id,
    status: p.status,
    link: p.link,
    city: str(meta.gorod),
    cityIn: str(meta.v_gorode),
    date: str(meta.data_kontserta),
    time: str(meta.vremia_kontserta),
    soldOut,
    postponedTo: postponedTo === '' ? null : postponedTo,
    modifiedGmt: p.modified_gmt,
  };
}

export async function fetchConcerts(opts: {
  baseUrl: string;
  postType: string;
  fetch?: typeof fetch;
  basicAuth?: { username: string; password: string };
}): Promise<Concert[]> {
  const doFetch = opts.fetch ?? fetch;
  const base = opts.baseUrl.replace(/\/+$/, '');
  const headers: Record<string, string> = {};
  if (opts.basicAuth) {
    headers.authorization =
      'Basic ' + Buffer.from(`${opts.basicAuth.username}:${opts.basicAuth.password}`).toString('base64');
  }

  const getPage = async (page: number): Promise<{ posts: WpPost[]; totalPages: number }> => {
    const url = `${base}/wp-json/wp/v2/${opts.postType}?per_page=100&page=${page}`;
    const res = await doFetch(url, { method: 'GET', headers });
    if (!res.ok) throw new Error(`fetchConcerts: GET ${url} returned HTTP ${res.status}`);
    const totalPages = Number(res.headers.get('x-wp-totalpages') ?? '1');
    if (!Number.isInteger(totalPages) || totalPages < 1) {
      throw new Error(`fetchConcerts: bad X-WP-TotalPages header on ${url}`);
    }
    const posts: unknown = await res.json();
    if (!Array.isArray(posts)) throw new Error(`fetchConcerts: non-array body on ${url}`);
    return { posts: posts as WpPost[], totalPages };
  };

  const first = await getPage(1);
  const posts = [...first.posts];
  for (let page = 2; page <= first.totalPages; page++) {
    posts.push(...(await getPage(page)).posts);
  }
  if (posts.length === 0) throw new Error('fetchConcerts: site returned an empty concert list');
  return posts.map(toConcert);
}
