import { buildChapterTree, flattenChapterTree, countLessons, ChapterNode } from '../lib/tree-utils';
import type { Chapter, LessonBrief } from '../lib/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeLesson(overrides: Partial<LessonBrief> = {}): LessonBrief {
  return {
    id: Math.random().toString(36).slice(2),
    title: 'Lesson',
    slug: 'lesson',
    reading_time_minutes: 5,
    is_published: true,
    order_in_chapter: 1,
    ...overrides,
  };
}

function makeChapter(overrides: Partial<Chapter> = {}): Chapter {
  return {
    id: Math.random().toString(36).slice(2),
    series_id: 'series-1',
    title: 'Chapter',
    order: 1,
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

const LEVELS = ['Chương', 'Phần', 'Mục'];

// ─── buildChapterTree ─────────────────────────────────────────────────────────

describe('buildChapterTree', () => {
  test('returns empty array for empty input', () => {
    expect(buildChapterTree([], LEVELS)).toEqual([]);
  });

  test('returns flat roots when no parent_id set', () => {
    const chapters: Chapter[] = [
      makeChapter({ id: 'a', order: 1 }),
      makeChapter({ id: 'b', order: 2 }),
    ];
    const tree = buildChapterTree(chapters, LEVELS);
    expect(tree).toHaveLength(2);
    expect(tree[0].id).toBe('a');
    expect(tree[1].id).toBe('b');
  });

  test('nests children under their parent', () => {
    const parent = makeChapter({ id: 'parent', order: 1 });
    const child = makeChapter({ id: 'child', order: 1, parent_id: 'parent' });
    const tree = buildChapterTree([parent, child], LEVELS);
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].id).toBe('child');
  });

  test('sorts roots by order', () => {
    const chapters: Chapter[] = [
      makeChapter({ id: 'c', order: 3 }),
      makeChapter({ id: 'a', order: 1 }),
      makeChapter({ id: 'b', order: 2 }),
    ];
    const tree = buildChapterTree(chapters, LEVELS);
    expect(tree.map((n) => n.id)).toEqual(['a', 'b', 'c']);
  });

  test('sorts children by order within parent', () => {
    const parent = makeChapter({ id: 'p', order: 1 });
    const c1 = makeChapter({ id: 'c1', order: 2, parent_id: 'p' });
    const c2 = makeChapter({ id: 'c2', order: 1, parent_id: 'p' });
    const tree = buildChapterTree([parent, c1, c2], LEVELS);
    expect(tree[0].children.map((n) => n.id)).toEqual(['c2', 'c1']);
  });

  test('assigns displayNumber to roots as "1", "2", ...', () => {
    const chapters: Chapter[] = [
      makeChapter({ id: 'a', order: 1 }),
      makeChapter({ id: 'b', order: 2 }),
    ];
    const tree = buildChapterTree(chapters, LEVELS);
    expect(tree[0].displayNumber).toBe('1');
    expect(tree[1].displayNumber).toBe('2');
  });

  test('assigns dotted displayNumber to children (e.g. "1.1", "1.2")', () => {
    const parent = makeChapter({ id: 'p', order: 1 });
    const c1 = makeChapter({ id: 'c1', order: 1, parent_id: 'p' });
    const c2 = makeChapter({ id: 'c2', order: 2, parent_id: 'p' });
    const tree = buildChapterTree([parent, c1, c2], LEVELS);
    expect(tree[0].children[0].displayNumber).toBe('1.1');
    expect(tree[0].children[1].displayNumber).toBe('1.2');
  });

  test('handles 3-level hierarchy with correct displayNumbers', () => {
    const root = makeChapter({ id: 'root', order: 1 });
    const mid = makeChapter({ id: 'mid', order: 1, parent_id: 'root' });
    const leaf = makeChapter({ id: 'leaf', order: 1, parent_id: 'mid' });
    const tree = buildChapterTree([root, mid, leaf], LEVELS);
    expect(tree[0].displayNumber).toBe('1');
    expect(tree[0].children[0].displayNumber).toBe('1.1');
    expect(tree[0].children[0].children[0].displayNumber).toBe('1.1.1');
  });

  test('ignores parent_id that does not exist in the list (treated as root)', () => {
    const ch = makeChapter({ id: 'orphan', order: 1, parent_id: 'non-existent' });
    const tree = buildChapterTree([ch], LEVELS);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('orphan');
  });
});

// ─── flattenChapterTree ───────────────────────────────────────────────────────

describe('flattenChapterTree', () => {
  test('returns empty array for empty tree', () => {
    expect(flattenChapterTree([])).toEqual([]);
  });

  test('flattens a single root with no children', () => {
    const root = makeChapter({ id: 'r', order: 1 });
    const tree = buildChapterTree([root], LEVELS);
    expect(flattenChapterTree(tree).map((n) => n.id)).toEqual(['r']);
  });

  test('flattens in depth-first order: root → child → grandchild', () => {
    const root = makeChapter({ id: 'root', order: 1 });
    const child = makeChapter({ id: 'child', order: 1, parent_id: 'root' });
    const grandchild = makeChapter({ id: 'gc', order: 1, parent_id: 'child' });
    const tree = buildChapterTree([root, child, grandchild], LEVELS);
    const flat = flattenChapterTree(tree);
    expect(flat.map((n) => n.id)).toEqual(['root', 'child', 'gc']);
  });

  test('includes every node exactly once with no duplicates', () => {
    const chapters: Chapter[] = [
      makeChapter({ id: 'r1', order: 1 }),
      makeChapter({ id: 'r2', order: 2 }),
      makeChapter({ id: 'c1', order: 1, parent_id: 'r1' }),
      makeChapter({ id: 'c2', order: 2, parent_id: 'r1' }),
      makeChapter({ id: 'gc1', order: 1, parent_id: 'c1' }),
    ];
    const tree = buildChapterTree(chapters, LEVELS);
    const flat = flattenChapterTree(tree);
    expect(flat).toHaveLength(5);
    expect(new Set(flat.map((n) => n.id)).size).toBe(5);
  });
});

// ─── countLessons ─────────────────────────────────────────────────────────────
// These tests directly verify the bug fix: parent chapters were displaying "0 bài học"
// because only direct lessons were counted, not lessons in descendant chapters.

describe('countLessons', () => {
  function buildNode(overrides: Partial<ChapterNode> = {}): ChapterNode {
    return {
      id: 'n',
      series_id: 's',
      title: 'T',
      order: 1,
      created_at: '',
      children: [],
      displayNumber: '1',
      fullPath: 'T',
      lessons: [],
      ...overrides,
    };
  }

  // ── Leaf nodes ────────────────────────────────────────────────────────────

  test('returns 0 when node has empty lessons array and no children', () => {
    expect(countLessons(buildNode({ lessons: [] }))).toBe(0);
  });

  test('returns 0 when lessons is undefined and no children', () => {
    expect(countLessons(buildNode({ lessons: undefined }))).toBe(0);
  });

  test('returns correct count for a leaf node with direct lessons', () => {
    const node = buildNode({ lessons: [makeLesson(), makeLesson(), makeLesson()] });
    expect(countLessons(node)).toBe(3);
  });

  // ── 2-level hierarchy (core bug fix) ─────────────────────────────────────

  test('BUG FIX — parent with 0 own lessons but children with lessons returns child total', () => {
    // Exact scenario reported: parent shows "0 bài học" instead of total
    const child1 = buildNode({ id: 'c1', lessons: [makeLesson(), makeLesson()] });
    const child2 = buildNode({ id: 'c2', lessons: [makeLesson()] });
    const parent = buildNode({ id: 'p', lessons: [], children: [child1, child2] });

    expect(countLessons(parent)).toBe(3); // 0 own + 2 + 1 from children
  });

  test('sums own lessons and child lessons for 2-level hierarchy', () => {
    const child = buildNode({ id: 'c', lessons: [makeLesson(), makeLesson()] });
    const parent = buildNode({ id: 'p', lessons: [makeLesson()], children: [child] });

    expect(countLessons(parent)).toBe(3); // 1 own + 2 child
  });

  // ── 3-level hierarchy (grandparent bug fix) ───────────────────────────────

  test('BUG FIX — grandparent with no own lessons returns total of all descendants', () => {
    const grandchild = buildNode({ id: 'gc', lessons: [makeLesson(), makeLesson(), makeLesson()] });
    const child = buildNode({ id: 'c', lessons: [], children: [grandchild] });
    const grandparent = buildNode({ id: 'gp', lessons: [], children: [child] });

    expect(countLessons(grandparent)).toBe(3);
  });

  test('counts all lessons across 3-level hierarchy with mixed own+child lessons', () => {
    const leaf1 = buildNode({ id: 'l1', lessons: [makeLesson(), makeLesson()] }); // 2
    const leaf2 = buildNode({ id: 'l2', lessons: [makeLesson()] });               // 1
    const mid   = buildNode({ id: 'm',  lessons: [makeLesson()], children: [leaf1, leaf2] }); // 1+3=4
    const root  = buildNode({ id: 'r',  lessons: [makeLesson()], children: [mid] }); // 1+4=5

    expect(countLessons(root)).toBe(5);
  });

  // ── Multiple sibling branches ─────────────────────────────────────────────

  test('sums lessons across multiple sibling branches', () => {
    const branchA_leaf = buildNode({ id: 'al', lessons: [makeLesson()] }); // 1
    const branchA = buildNode({ id: 'a', lessons: [], children: [branchA_leaf] }); // 1
    const branchB = buildNode({ id: 'b', lessons: [makeLesson(), makeLesson()] }); // 2
    const root = buildNode({ id: 'r', lessons: [], children: [branchA, branchB] }); // 3

    expect(countLessons(root)).toBe(3);
  });

  // ── Integration with buildChapterTree output ──────────────────────────────

  test('works correctly on a root node produced by buildChapterTree', () => {
    const l1 = makeLesson({ id: 'l1' });
    const l2 = makeLesson({ id: 'l2' });
    const l3 = makeLesson({ id: 'l3' });

    const rootRaw = makeChapter({ id: 'root', order: 1, lessons: [l3] });
    const childRaw = makeChapter({ id: 'child', order: 1, parent_id: 'root', lessons: [l1, l2] });

    const tree = buildChapterTree([rootRaw, childRaw], LEVELS);
    const rootNode = tree[0];

    // root: 1 own lesson + child with 2 lessons = 3 total
    expect(countLessons(rootNode)).toBe(3);
  });

  test('child node in a tree counts only its own subtotal, not the parent', () => {
    const l1 = makeLesson();
    const l2 = makeLesson();
    const l3 = makeLesson();

    const rootRaw = makeChapter({ id: 'root', order: 1, lessons: [l1] });
    const childRaw = makeChapter({ id: 'child', order: 1, parent_id: 'root', lessons: [l2, l3] });

    const tree = buildChapterTree([rootRaw, childRaw], LEVELS);
    const childNode = tree[0].children[0];

    // Child has 2 lessons — should NOT include parent's 1
    expect(countLessons(childNode)).toBe(2);
  });
});
