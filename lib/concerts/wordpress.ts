export type Concert = {
  id: number;
  status: string;
  link: string;
  city: string;
  cityIn: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM city local
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
  link?: string;
  modified_gmt?: string;
};

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function toConcert(p: WpPost & WpMeta): Concert {
  const soldOut = p.sold_out === true || p.sold_out === 'true' || p.sold_out === '1' || p.sold_out === 1;
  return {
    id: p.id,
    status: p.status,
    link: str(p.link),
    city: str(p.gorod),
    cityIn: str(p.v_gorode),
    date: str(p.data_kontserta),
    time: str(p.vremia_kontserta),
    soldOut,
    postponedTo: str(p.perenos_kontserta) || null,
    modifiedGmt: str(p.modified_gmt),
  };
}

async function fetchSnapshot(base: string, postType: string, doFetch: typeof fetch): Promise<Concert[]> {
  const encodedPostType = encodeURIComponent(postType);
  const url = `${base}/${encodedPostType}.json`;
  const res = await doFetch(url, { method: 'GET', redirect: 'error' });
  if (!res.ok) throw new Error(`fetchConcerts: GET ${url} returned HTTP ${res.status}`);
  const posts: unknown = await res.json();
  if (!Array.isArray(posts)) throw new Error(`fetchConcerts: non-array body on ${url}`);
  if (posts.length === 0) throw new Error('fetchConcerts: site returned an empty concert list');
  return posts.map((post: WpPost & WpMeta) => {
    if (!post || !Number.isSafeInteger(post.id) || post.id < 1 || typeof post.status !== 'string') {
      throw new Error(`fetchConcerts: invalid concert in ${url}`);
    }
    // The snapshot omits pretty permalinks. Published posts still have a URL by ID.
    const link = post.status === 'publish' ? `${base}/?post_type=${encodedPostType}&p=${post.id}` : '';
    return toConcert({ ...post, link: str(post.link) || link });
  });
}

export async function fetchConcerts(opts: {
  baseUrl: string;
  postType: string;
  fetch?: typeof fetch;
  basicAuth?: { username: string; password: string };
}): Promise<Concert[]> {
  const doFetch = opts.fetch ?? fetch;
  const base = opts.baseUrl.replace(/\/+$/, '');
  if (new URL(base).hostname === 'atmosphere-show.ru') {
    return fetchSnapshot(base, opts.postType, doFetch);
  }

  const headers: Record<string, string> = {};
  if (opts.basicAuth) {
    headers.authorization =
      'Basic ' + Buffer.from(`${opts.basicAuth.username}:${opts.basicAuth.password}`).toString('base64');
  }

  const getPage = async (page: number): Promise<{ posts: (WpPost & { meta?: WpMeta })[]; totalPages: number }> => {
    const url = `${base}/wp-json/wp/v2/${opts.postType}?per_page=100&page=${page}`;
    const res = await doFetch(url, { method: 'GET', headers });
    if (!res.ok) throw new Error(`fetchConcerts: GET ${url} returned HTTP ${res.status}`);
    const totalPages = Number(res.headers.get('x-wp-totalpages') ?? '1');
    if (!Number.isInteger(totalPages) || totalPages < 1) {
      throw new Error(`fetchConcerts: bad X-WP-TotalPages header on ${url}`);
    }
    const posts: unknown = await res.json();
    if (!Array.isArray(posts)) throw new Error(`fetchConcerts: non-array body on ${url}`);
    return { posts, totalPages };
  };

  const first = await getPage(1);
  const posts = [...first.posts];
  for (let page = 2; page <= first.totalPages; page++) {
    posts.push(...(await getPage(page)).posts);
  }
  if (posts.length === 0) throw new Error('fetchConcerts: site returned an empty concert list');
  return posts.map((post) => toConcert({ ...post.meta, ...post }));
}
