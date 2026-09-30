import { fetchUserBookmarks, API_BASE_URL } from '../lib/api';
import type { PaginatedPosts } from '../lib/types';

// Mock global fetch before all tests
beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.resetAllMocks();
});

/** Helper: create a minimal ok Response with a JSON body */
function mockOkResponse(body: unknown): Response {
  return {
    ok: true,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(''),
  } as unknown as Response;
}

/** Helper: create a not-ok Response with a text body */
function mockErrResponse(text: string): Response {
  return {
    ok: false,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(text),
  } as unknown as Response;
}

const PAGINATED_RESPONSE: PaginatedPosts = {
  items: [],
  total: 0,
  page: 1,
  limit: 10,
  total_pages: 1,
};

// ── Test 1: URL building with page and limit ─────────────────────────────────
describe('fetchUserBookmarks — URL building', () => {
  test('appends page and limit query params when provided', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse(PAGINATED_RESPONSE));

    await fetchUserBookmarks('alice', { page: 2, limit: 5 });

    const calledUrl: string = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(calledUrl).toContain('page=2');
    expect(calledUrl).toContain('limit=5');
    expect(calledUrl).toContain(`${API_BASE_URL}/blog/users/alice/bookmarks`);
  });

  test('builds correct full URL with username and both params', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse(PAGINATED_RESPONSE));

    await fetchUserBookmarks('bob', { page: 3, limit: 20 });

    const calledUrl: string = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(calledUrl).toMatch(
      new RegExp(`/blog/users/bob/bookmarks\\?.*page=3.*limit=20|/blog/users/bob/bookmarks\\?.*limit=20.*page=3`)
    );
  });
});

// ── Test 2: Default params — no query string ─────────────────────────────────
describe('fetchUserBookmarks — default params', () => {
  test('fetches without query string when no params given', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse(PAGINATED_RESPONSE));

    await fetchUserBookmarks('alice');

    const calledUrl: string = (global.fetch as jest.Mock).mock.calls[0][0];
    // URL must end exactly with "/bookmarks" (no "?")
    expect(calledUrl).toMatch(/\/blog\/users\/alice\/bookmarks$/);
    expect(calledUrl).not.toContain('?');
  });

  test('fetches without query string when params object is empty', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse(PAGINATED_RESPONSE));

    await fetchUserBookmarks('alice', {});

    const calledUrl: string = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(calledUrl).not.toContain('?');
  });
});

// ── Test 3: Return shape ─────────────────────────────────────────────────────
describe('fetchUserBookmarks — return shape', () => {
  test('returns the PaginatedPosts shape from response JSON', async () => {
    const mockData: PaginatedPosts = {
      items: [],
      total: 42,
      page: 2,
      limit: 10,
      total_pages: 5,
    };
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse(mockData));

    const result = await fetchUserBookmarks('alice', { page: 2, limit: 10 });

    expect(result).toEqual(mockData);
    expect(result.total).toBe(42);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
    expect(result.total_pages).toBe(5);
    expect(Array.isArray(result.items)).toBe(true);
  });

  test('returns exact JSON from the response without mutation', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse(PAGINATED_RESPONSE));

    const result = await fetchUserBookmarks('alice');

    expect(result).toEqual(PAGINATED_RESPONSE);
  });
});

// ── Test 4: Token header present ─────────────────────────────────────────────
describe('fetchUserBookmarks — token header', () => {
  test('sends Authorization: Bearer <token> header when token is provided', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse(PAGINATED_RESPONSE));

    await fetchUserBookmarks('alice', undefined, 'my-secret-token');

    const calledOptions = (global.fetch as jest.Mock).mock.calls[0][1];
    const headers = calledOptions?.headers as Record<string, string>;

    expect(headers).toBeDefined();
    expect(headers['Authorization']).toBe('Bearer my-secret-token');
  });

  test('includes Content-Type header together with Authorization', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse(PAGINATED_RESPONSE));

    await fetchUserBookmarks('alice', undefined, 'tok-abc');

    const calledOptions = (global.fetch as jest.Mock).mock.calls[0][1];
    const headers = calledOptions?.headers as Record<string, string>;

    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['Authorization']).toBe('Bearer tok-abc');
  });
});

// ── Test 5: No token — no Authorization header ───────────────────────────────
describe('fetchUserBookmarks — no token', () => {
  test('sends empty headers object when no token is provided', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse(PAGINATED_RESPONSE));

    await fetchUserBookmarks('alice');

    const calledOptions = (global.fetch as jest.Mock).mock.calls[0][1];
    const headers = calledOptions?.headers as Record<string, string>;

    expect(headers).toEqual({});
    expect(headers['Authorization']).toBeUndefined();
  });

  test('does not include Authorization header when token is undefined', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse(PAGINATED_RESPONSE));

    await fetchUserBookmarks('alice', { page: 1 }, undefined);

    const calledOptions = (global.fetch as jest.Mock).mock.calls[0][1];
    const headers = calledOptions?.headers as Record<string, string>;

    expect(headers['Authorization']).toBeUndefined();
  });
});

// ── Edge case: error response throws ────────────────────────────────────────
describe('fetchUserBookmarks — error handling', () => {
  test('throws Error when response is not ok', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockErrResponse('Not Found'));

    await expect(fetchUserBookmarks('alice')).rejects.toThrow('Not Found');
  });
});
