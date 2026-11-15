import type { WorkbenchDocument } from './document/document.js';
import type { TemplateKind, TemplateTokens } from './template/index.js';

export interface TemplateSummary {
  readonly id: string;
  readonly title: string;
  readonly kind: TemplateKind;
  readonly publicEligible: boolean;
}

export interface DocumentEntry {
  readonly relativePath: string;
  readonly source: string;
  readonly document: WorkbenchDocument;
}

export interface DocumentSummary {
  readonly relativePath: string;
  readonly label: string;
  readonly title: string;
  readonly kind: WorkbenchDocument['kind'];
  readonly updatedAt: string;
  /** 책의 표지 경로(작업 공간 기준). 책이 아니거나 표지가 없으면 없다. */
  readonly cover?: string;
}

export interface CreateFromTemplateInput {
  readonly templateId: string;
  readonly title: string;
  readonly tokens: TemplateTokens;
}

/**
 * 목록을 만들다 읽지 못한 파일 (NOR-190).
 *
 * 이 앱의 원본은 손으로 고치는 Markdown 이다. 손이 미끄러진 파일 하나가 도구 전체를 못 쓰게
 * 만들면 안 되므로, 실패는 예외로 던지지 않고 **결과의 일부로** 돌려준다. 그렇다고 조용히
 * 감추지도 않는다 — 감추면 사용자는 파일이 사라진 줄 안다.
 */
export interface DocumentProblem {
  readonly relativePath: string;
  readonly message: string;
}

export interface DocumentList {
  readonly documents: readonly DocumentSummary[];
  readonly problems: readonly DocumentProblem[];
}

export interface FileStore {
  listTemplates(): Promise<readonly TemplateSummary[]>;
  listDocuments(): Promise<DocumentList>;
  createFromTemplate(input: CreateFromTemplateInput): Promise<DocumentEntry>;
  readDocument(relativePath: string): Promise<DocumentEntry>;
  writeDocument(relativePath: string, source: string): Promise<DocumentEntry>;
  /**
   * 밖에서 들어온 문서를 자리에 놓는다 (NOR-187).
   *
   * `writeDocument` 는 이미 있는 문서만 고칠 수 있고 `createFromTemplate` 는 템플릿에서만
   * 만든다. 가져오기는 둘 다 아니어서 별도의 문이 필요하다. 덮어쓰기는 **부르는 쪽이 그렇게
   * 정했을 때만** 일어난다.
   */
  importDocument(input: {
    readonly relativePath: string;
    readonly source: string;
    readonly overwrite: boolean;
  }): Promise<DocumentEntry>;
}

export interface GitRepo {
  status(): Promise<{ readonly clean: boolean; readonly files: readonly string[] }>;
  commit(paths: readonly string[], message: string): Promise<string>;
}

export interface PublicBlog {
  readonly postsRoot: string;
  readPost(slug: string): Promise<string | null>;
}
