import { Chapter } from "@/lib/types";

export interface ChapterNode extends Chapter {
  children: ChapterNode[];
  displayNumber: string;
  fullPath: string;
}

export function buildChapterTree(chapters: Chapter[], levels: string[]): ChapterNode[] {
  const map = new Map<string, ChapterNode>();
  chapters.forEach((ch) => {
    map.set(ch.id, {
      ...ch,
      children: [],
      displayNumber: "",
      fullPath: ch.title,
    });
  });

  const roots: ChapterNode[] = [];
  chapters.forEach((ch) => {
    const node = map.get(ch.id)!;
    if (ch.parent_id && map.has(ch.parent_id)) {
      map.get(ch.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  function assignMetadata(node: ChapterNode, prefix: string, parentPath: string) {
    node.displayNumber = prefix;
    node.fullPath = parentPath ? `${parentPath} > ${node.title}` : node.title;
    node.children.sort((a, b) => a.order - b.order);
    node.children.forEach((child, idx) => {
      assignMetadata(child, `${prefix ? `${prefix}.` : ""}${idx + 1}`, node.fullPath);
    });
  }

  roots.sort((a, b) => a.order - b.order);
  roots.forEach((root, idx) => {
    assignMetadata(root, `${idx + 1}`, "");
  });

  return roots;
}

export function flattenChapterTree(nodes: ChapterNode[]): ChapterNode[] {
  const list: ChapterNode[] = [];
  function traverse(n: ChapterNode) {
    list.push(n);
    n.children.forEach(traverse);
  }
  nodes.forEach(traverse);
  return list;
}
