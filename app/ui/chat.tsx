"use client";

import { FormEvent, KeyboardEvent, useRef, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";

type Source = { title: string; authority: string; url: string; status?: string };
type Answer = { text: string; sources: Source[] };
type Message = { role: "user" | "assistant"; content: string; sources?: Source[] };

const prompts = ["Quelles demandes concernent les notes de frais ?", "Trouve les demandes liées à la qualité de l’eau", "Y a-t-il des demandes adressées à la CNIL ?"];

function sourceId(messageIndex: number, sourceIndex: number) {
  return `source-${messageIndex}-${sourceIndex + 1}`;
}

function linkCitations(text: string, messageIndex: number, sourceCount: number) {
  return text.replace(/\[(\d+)\](?!\()/g, (citation, number) => {
    const sourceIndex = Number(number) - 1;
    if (sourceIndex < 0 || sourceIndex >= sourceCount) return citation;
    return `[${number}](#${sourceId(messageIndex, sourceIndex)})`;
  });
}

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hoveredSource, setHoveredSource] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function send(question = input) {
    const content = question.trim();
    if (!content || loading) return;
    setInput("");
    setMessages((current) => [...current, { role: "user", content }]);
    setLoading(true);
    abortRef.current = new AbortController();
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: content, history: messages.slice(-4) }),
        signal: abortRef.current.signal
      });
      const answer = (await response.json()) as Answer & { error?: string };
      if (!response.ok) throw new Error(answer.error || "La recherche est momentanément indisponible.");
      setMessages((current) => [...current, { role: "assistant", content: answer.text, sources: answer.sources }]);
    } catch (error) {
      if ((error as Error).name !== "AbortError") setMessages((current) => [...current, { role: "assistant", content: `Je n’ai pas pu répondre : ${(error as Error).message}` }]);
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  const markdownComponents: Components = {
    a: ({ href, children, ...props }) => {
      const citationNumber = href?.match(/^#source-\d+-(\d+)$/)?.[1];
      const citationId = citationNumber ? href : null;
      return <a
        {...props}
        href={href}
        className={citationId ? "citation" : undefined}
        aria-label={citationId ? `Voir la source ${citationNumber}` : undefined}
        onMouseEnter={citationId ? () => setHoveredSource(citationId) : undefined}
        onMouseLeave={citationId ? () => setHoveredSource(null) : undefined}
        onFocus={citationId ? () => setHoveredSource(citationId) : undefined}
        onBlur={citationId ? () => setHoveredSource(null) : undefined}
      >{children}</a>;
    }
  };

  function submit(event: FormEvent) { event.preventDefault(); void send(); }
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  return <section className="chat-shell" aria-label="Assistant de recherche">
    {messages.length === 0 ? <div className="empty-state">
      <div className="orb">⌕</div>
      <h2>Que cherchez-vous ?</h2>
      <p>Posez une question sur les demandes, les administrations ou les documents publiés.</p>
      <div className="suggestions">{prompts.map((prompt) => <button key={prompt} onClick={() => void send(prompt)}>{prompt}</button>)}</div>
    </div> : <div className="conversation" aria-live="polite">
      {messages.map((message, index) => <article className={`message ${message.role}`} key={index}>
        <div className="message-label">{message.role === "user" ? "Vous" : "Chat DADA"}</div>
        {message.role === "assistant" ? <div className="message-body markdown-body">
          <ReactMarkdown components={markdownComponents}>{linkCitations(message.content, index, message.sources?.length ?? 0)}</ReactMarkdown>
        </div> : <p className="message-body">{message.content}</p>}
        {message.sources && message.sources.length > 0 && <div className="sources"><span>Sources Ma Dada</span>{message.sources.map((source, sourceIndex) => {
          const id = sourceId(index, sourceIndex);
          return <a
            className={hoveredSource === id ? "is-highlighted" : undefined}
            id={id}
            key={source.url}
            href={source.url}
            target="_blank"
            rel="noreferrer"
            onMouseEnter={() => setHoveredSource(id)}
            onMouseLeave={() => setHoveredSource(null)}
            onFocus={() => setHoveredSource(id)}
            onBlur={() => setHoveredSource(null)}
          ><b>{source.title}</b><small>{source.authority}{source.status ? ` · ${source.status}` : ""}</small><i>↗</i></a>;
        })}</div>}
      </article>)}
      {loading && <article className="message assistant thinking"><div className="message-label">Chat DADA</div><p className="message-body">Je consulte les demandes publiées…</p></article>}
    </div>}
    <form onSubmit={submit} className="composer">
      <label className="sr-only" htmlFor="question">Votre question</label>
      <textarea id="question" rows={3} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={onKeyDown} placeholder="Ex. Trouve les demandes sur les marchés publics à Lyon" disabled={loading} />
      {loading ? <button type="button" className="stop" onClick={() => abortRef.current?.abort()}>Arrêter</button> : <button type="submit" disabled={!input.trim()}>Envoyer <span>↗</span></button>}
    </form>
    <p className="notice">Les réponses sont générées à partir des résultats publics les plus pertinents. Vérifiez toujours les sources liées.</p>
  </section>;
}
