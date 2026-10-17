import {
  fetchSeries,
  fetchKnowledgeBases,
  fetchKnowledgeBase,
  createKnowledgeBase,
  updateKnowledgeBase,
  deleteKnowledgeBase,
  triggerKBIndex,
  fetchKBOptionData,
  queryRAG,
  API_BASE_URL,
} from '../lib/api';

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.resetAllMocks();
});

function mockOkResponse(body: unknown): Response {
  return {
    ok: true,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(''),
  } as unknown as Response;
}

function mockErrResponse(detail: string, status = 400): Response {
  return {
    ok: false,
    status,
    statusText: detail,
    json: () => Promise.resolve({ detail }),
    text: () => Promise.resolve(detail),
  } as unknown as Response;
}

// ── Series API Tests (includeDrafts & Auth) ───────────────────────────────────

describe('fetchSeries — Draft visibility and Auth', () => {
  test('calls /blog/series without query when includeDrafts is not set', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse([]));

    const result = await fetchSeries();
    expect(result).toEqual([]);

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/blog/series`);
    expect(init?.headers?.Authorization).toBeUndefined();
  });

  test('appends include_drafts=true and auth header when requested by admin', async () => {
    const mockSeries = [
      { id: 's-1', title: 'Series 1', slug: 'series-1', is_published: false },
    ];
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse(mockSeries));

    const result = await fetchSeries({ includeDrafts: true, token: 'admin-token-123' });
    expect(result).toEqual(mockSeries);

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/blog/series?include_drafts=true`);
    expect(init?.headers?.Authorization).toBe('Bearer admin-token-123');
    expect(init?.cache).toBe('no-store');
  });

  test('returns empty array when backend returns non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockErrResponse('Unauthorized', 401));

    const result = await fetchSeries();
    expect(result).toEqual([]);
  });
});

// ── Knowledge Base API Tests ──────────────────────────────────────────────────

describe('Knowledge Base API Methods', () => {
  const sampleKB = {
    id: 'kb-test-1',
    name: 'Kho Tri Thức AI',
    slug: 'kho-tri-thuc-ai',
    description: 'Tài liệu kiến trúc AI',
    is_active: true,
    created_at: '2026-10-17T00:00:00Z',
    updated_at: '2026-10-17T00:00:00Z',
    series_count: 1,
    direct_posts_count: 2,
    effective_posts_count: 5,
    is_indexed: true,
    num_vectors: 15,
    series: [],
    posts: [],
  };

  test('fetchKnowledgeBases calls /rag/kb and passes include_inactive flag', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse([sampleKB]));

    const result = await fetchKnowledgeBases('admin-token', true);
    expect(result).toEqual([sampleKB]);

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/rag/kb?include_inactive=true`);
    expect(init?.headers?.Authorization).toBe('Bearer admin-token');
  });

  test('fetchKnowledgeBase gets single KB by id or slug', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse(sampleKB));

    const kb = await fetchKnowledgeBase('kb-test-1', 'user-token');
    expect(kb).toEqual(sampleKB);

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/rag/kb/kb-test-1`);
    expect(init?.headers?.Authorization).toBe('Bearer user-token');
  });

  test('createKnowledgeBase sends POST with json payload and auth token', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse(sampleKB));

    const payload = {
      name: 'Kho Tri Thức AI',
      description: 'Mô tả',
      series_ids: ['s-1'],
      post_ids: ['p-1'],
    };

    const created = await createKnowledgeBase(payload, 'admin-token');
    expect(created).toEqual(sampleKB);

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/rag/kb`);
    expect(init?.method).toBe('POST');
    expect(init?.headers?.Authorization).toBe('Bearer admin-token');
    expect(JSON.parse(init?.body as string)).toEqual(payload);
  });

  test('updateKnowledgeBase sends PUT with updated data', async () => {
    const updatedKB = { ...sampleKB, name: 'Tên Đã Đổi' };
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse(updatedKB));

    const updatePayload = { name: 'Tên Đã Đổi', is_active: false };
    const res = await updateKnowledgeBase('kb-test-1', updatePayload, 'admin-token');
    expect(res.name).toBe('Tên Đã Đổi');

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/rag/kb/kb-test-1`);
    expect(init?.method).toBe('PUT');
    expect(init?.headers?.Authorization).toBe('Bearer admin-token');
    expect(JSON.parse(init?.body as string)).toEqual(updatePayload);
  });

  test('deleteKnowledgeBase sends DELETE', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse({ message: 'Deleted' }));

    await expect(deleteKnowledgeBase('kb-test-1', 'admin-token')).resolves.not.toThrow();

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/rag/kb/kb-test-1`);
    expect(init?.method).toBe('DELETE');
    expect(init?.headers?.Authorization).toBe('Bearer admin-token');
  });

  test('triggerKBIndex calls /rag/kb/:id/index with POST', async () => {
    const indexResult = { success: true, message: 'Done', num_posts: 10 };
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse(indexResult));

    const res = await triggerKBIndex('kb-test-1', 'admin-token');
    expect(res).toEqual(indexResult);

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/rag/kb/kb-test-1/index`);
    expect(init?.method).toBe('POST');
    expect(init?.headers?.Authorization).toBe('Bearer admin-token');
  });

  test('fetchKBOptionData calls /rag/kb-options with auth header', async () => {
    const optionsData = { series: [], posts: [] };
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse(optionsData));

    const res = await fetchKBOptionData('admin-token');
    expect(res).toEqual(optionsData);

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/rag/kb-options`);
    expect(init?.headers?.Authorization).toBe('Bearer admin-token');
  });
});

// ── queryRAG with kb_id Tests ─────────────────────────────────────────────────

describe('queryRAG — Multi-Knowledge-Base query', () => {
  test('sends query without kb_id for all posts RAG', async () => {
    const ragAnswer = {
      answer: 'Trả lời chung',
      sources: [{ title: 'Bài viết 1', slug: 'bai-1', similarity_score: 0.9, snippet: 'Trích đoạn' }],
    };
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse(ragAnswer));

    const res = await queryRAG('Học gì trước?', 3);
    expect(res).toEqual(ragAnswer);

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/rag/query`);
    expect(JSON.parse(init?.body as string)).toEqual({
      query: 'Học gì trước?',
      top_k: 3,
    });
  });

  test('sends query with kb_id when specific Knowledge Base is selected', async () => {
    const ragAnswer = {
      answer: 'Trả lời từ kho AI',
      sources: [{ title: 'Bài AI', slug: 'bai-ai', similarity_score: 0.95, snippet: 'LLM...' }],
      kb_id: 'kb-ai-001',
      kb_name: 'Kho Tri Thức AI',
    };
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse(ragAnswer));

    const res = await queryRAG('LLM hoạt động ra sao?', 5, 'token-123', 'kb-ai-001');
    expect(res).toEqual(ragAnswer);

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/rag/query`);
    expect(init?.headers?.Authorization).toBe('Bearer token-123');
    expect(JSON.parse(init?.body as string)).toEqual({
      query: 'LLM hoạt động ra sao?',
      top_k: 5,
      kb_id: 'kb-ai-001',
    });
  });

  test('throws error if RAG service fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockErrResponse('Kho tri thức này chưa được lập chỉ mục FAISS', 400)
    );

    await expect(queryRAG('Câu hỏi?', 5, undefined, 'kb-empty')).rejects.toThrow(
      'Kho tri thức này chưa được lập chỉ mục FAISS'
    );
  });
});
