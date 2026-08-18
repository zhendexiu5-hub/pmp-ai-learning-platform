import { Link } from "react-router";

export function Brand({ staticLink = false }: { staticLink?: boolean }) {
  const content = <><img className="brand-wordmark" src="/runloop-wordmark.png" alt="runloop" /><small>AI教学课堂</small></>;
  if (staticLink) return <div className="brand brand-static" aria-label="RUNLOOP AI教学课堂">{content}</div>;
  return <Link className="brand" to="/" aria-label="RUNLOOP AI教学课堂，返回学习首页">{content}</Link>;
}
