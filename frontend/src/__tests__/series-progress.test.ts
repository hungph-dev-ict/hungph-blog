import {
  getSeriesProgress,
  toggleLessonProgress,
  resetSeriesProgress,
  getAdminSeriesProgress,
  API_BASE_URL,
  type SeriesProgressData,
  type AdminProgressEntry,
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

function mockErrResponse(status: number, detail: string): Response {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ detail }),
    text: () => Promise.resolve(detail),
  } as unknown as Response;
}

const SAMPLE_PROGRESS: SeriesProgressData = {
  series_id: 'series-abc',
  user_id: 'user-123',
  completed_lesson_ids: ['lesson-1', 'lesson-2'],
  total_lessons: 5,
  completed_count: 2,
  percent: 40.0,
};

const SAMPLE_ADMIN_PROGRESS: AdminProgressEntry[] = [
  {
    user_id: 'user-1',
    username: 'alex',
    full_name: 'Alex Johnson',
    avatar_url: 'https://example.com/alex.png',
    completed_count: 5,
    total_lessons: 5,
    percent: 100.0,
    updated_at: '2026-10-15T10:00:00Z',
  },
  {
    user_id: 'user-2',
    username: 'bob',
    completed_count: 2,
    total_lessons: 5,
    percent: 40.0,
    updated_at: '2026-10-14T08:00:00Z',
  },
];

describe('Series Progress API Client', () => {
  describe('getSeriesProgress', () => {
    test('calls correct endpoint with auth header and returns progress data', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse(SAMPLE_PROGRESS));

      const result = await getSeriesProgress('series-abc', 'test-token-123');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe(`${API_BASE_URL}/blog/series/series-abc/progress`);
      expect(options.headers).toMatchObject({
        Authorization: 'Bearer test-token-123',
      });
      expect(result).toEqual(SAMPLE_PROGRESS);
      expect(result.percent).toBe(40.0);
      expect(result.completed_lesson_ids).toContain('lesson-1');
    });

    test('throws error with server message when response is not ok', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockErrResponse(404, 'Series không tìm thấy')
      );

      await expect(getSeriesProgress('invalid-id', 'test-token-123')).rejects.toThrow(
        'Series không tìm thấy'
      );
    });
  });

  describe('toggleLessonProgress', () => {
    test('sends POST request with lesson_id in JSON body', async () => {
      const updatedProgress: SeriesProgressData = {
        ...SAMPLE_PROGRESS,
        completed_lesson_ids: ['lesson-1', 'lesson-2', 'lesson-3'],
        completed_count: 3,
        percent: 60.0,
      };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse(updatedProgress));

      const result = await toggleLessonProgress('series-abc', 'lesson-3', 'test-token-123');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe(`${API_BASE_URL}/blog/series/series-abc/progress/toggle`);
      expect(options.method).toBe('POST');
      expect(options.headers).toMatchObject({
        Authorization: 'Bearer test-token-123',
        'Content-Type': 'application/json',
      });
      expect(JSON.parse(options.body)).toEqual({ lesson_id: 'lesson-3' });
      expect(result.completed_count).toBe(3);
      expect(result.percent).toBe(60.0);
    });

    test('throws error when lesson does not belong to series', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockErrResponse(400, 'Bài học không thuộc series này')
      );

      await expect(
        toggleLessonProgress('series-abc', 'alien-lesson', 'test-token-123')
      ).rejects.toThrow('Bài học không thuộc series này');
    });
  });

  describe('resetSeriesProgress', () => {
    test('sends DELETE request and receives 0% progress response', async () => {
      const resetProgress: SeriesProgressData = {
        series_id: 'series-abc',
        user_id: 'user-123',
        completed_lesson_ids: [],
        total_lessons: 5,
        completed_count: 0,
        percent: 0.0,
      };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse(resetProgress));

      const result = await resetSeriesProgress('series-abc', 'test-token-123');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe(`${API_BASE_URL}/blog/series/series-abc/progress`);
      expect(options.method).toBe('DELETE');
      expect(options.headers).toMatchObject({
        Authorization: 'Bearer test-token-123',
      });
      expect(result.completed_lesson_ids).toEqual([]);
      expect(result.percent).toBe(0.0);
      expect(result.completed_count).toBe(0);
    });

    test('throws error when server fails to reset', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockErrResponse(500, 'Không thể reset tiến độ')
      );

      await expect(resetSeriesProgress('series-abc', 'test-token-123')).rejects.toThrow(
        'Không thể reset tiến độ'
      );
    });
  });

  describe('getAdminSeriesProgress', () => {
    test('sends GET request to admin progress route and returns learner list', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockOkResponse(SAMPLE_ADMIN_PROGRESS));

      const result = await getAdminSeriesProgress('series-abc', 'admin-token');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe(`${API_BASE_URL}/blog/series/series-abc/admin/progress`);
      expect(options.headers).toMatchObject({
        Authorization: 'Bearer admin-token',
      });
      expect(result).toHaveLength(2);
      expect(result[0].username).toBe('alex');
      expect(result[0].percent).toBe(100.0);
      expect(result[1].percent).toBe(40.0);
    });

    test('throws 403 Forbidden error for non-admin/non-collaborator user', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockErrResponse(403, 'Không có quyền xem tiến độ thành viên')
      );

      await expect(
        getAdminSeriesProgress('series-abc', 'regular-member-token')
      ).rejects.toThrow('Không có quyền xem tiến độ thành viên');
    });
  });
});
