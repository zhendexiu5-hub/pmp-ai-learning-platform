import { FormEvent, useState } from "react";
import { Link } from "react-router";
import { api, type KnowledgeSearchResult } from "../api";
import { EmptyState } from "../components/PageState";

export function KnowledgePage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KnowledgeSearchResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function search(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    setBusy(true); setError("");
    try { setResults((await api<{ results: KnowledgeSearchResult[] }>(`/api/v1/search?q=${encodeURIComponent(query.trim())}`)).results); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "检索失败"); }
    finally { setBusy(false); }
  }
  return <main className="knowledge-page page-frame">
    <header className="page-heading"><p className="page-kicker">知识检索</p><h1>从 209 个知识点中找到判断依据。</h1><p>当前使用 D1 FTS5 检索标题、考试重点与常见陷阱。</p></header>
    <form className="knowledge-search" onSubmit={search} role="search"><label htmlFor="knowledge-query">搜索知识点、考试重点或易错表达</label><div><input id="knowledge-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例如：项目与运营、变更、风险应对" /><button className="primary-button" disabled={busy || !query.trim()}>{busy ? "检索中…" : "搜索"}</button></div></form>
    {error && <p className="form-error" role="alert">{error}</p>}
    {results === null ? <section className="knowledge-intro"><span className="section-index">检索范围</span><div><strong>标题与术语</strong><p>中文名称、英文术语和章节位置。</p></div><div><strong>考试重点</strong><p>情境题中需要识别的判断线索。</p></div><div><strong>常见陷阱</strong><p>高频混淆与错误决策方式。</p></div></section> : results.length === 0 ? <EmptyState title="没有找到匹配知识点" detail="尝试使用更短的概念词，或改用考试情境中的关键词。" /> : <section className="search-results" aria-live="polite"><div className="section-heading"><div><span className="section-index">结果</span><h2>找到 {results.length} 个知识点</h2></div></div>{results.map((item) => <article key={item.id}><div><span>{item.id} · Chapter {item.chapter_id}</span><h3>{item.title_zh}</h3><small>{item.title_en}</small></div><p>{item.exam_focus}</p><span className={`coverage-tag ${item.content_coverage}`}>{coverageText(item.content_coverage)}</span><Link to="/learn">进入课堂</Link></article>)}</section>}
  </main>;
}

function coverageText(value: string) {
  return value === "teachable" ? "可完整教学" : value === "brief" ? "有限讲解" : "仅索引";
}
