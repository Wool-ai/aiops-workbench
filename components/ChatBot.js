import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import styles from '../styles/ChatBot.module.css';

function TypingDots() {
  return (
    <div className={styles.typingDots}>
      <span /><span /><span />
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`${styles.msgRow} ${isUser ? styles.msgRowUser : styles.msgRowAI}`}>
      {!isUser && (
        <div className={styles.avatar}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.42-1.42M17.66 6.34l1.42-1.42"/>
          </svg>
        </div>
      )}
      <div className={`${styles.bubble} ${isUser ? styles.bubbleUser : styles.bubbleAI}`}>
        {isUser ? msg.content : (
          <div className={styles.md}>
            <ReactMarkdown
              components={{
                a: ({ node, ...props }) => (
                  <a {...props} target="_blank" rel="noopener noreferrer" />
                ),
              }}
            >
              {msg.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const streamAbortRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const newMessages = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    setStreamingContent('');

    // Create abort controller for cancellation
    streamAbortRef.current = new AbortController();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, stream: true }),
        signal: streamAbortRef.current.signal,
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('Response error:', res.status, errorText);
        throw new Error(`Failed to fetch: ${res.status}`);
      }

      console.log('Stream started, reading chunks...');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let chunkCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('Stream ended. Total chunks received:', chunkCount);
          break;
        }

        chunkCount++;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(line.slice(6));
            console.log('Received event:', data.t, data.delta?.substring(0, 20) || '...');

            if (data.t === 'text') {
              setStreamingContent(prev => prev + data.delta);
            } else if (data.t === 'done') {
              // Streaming complete
              console.log('Stream complete');
              setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
              setStreamingContent('');
            } else if (data.t === 'error') {
              console.log('Stream error:', data.message);
              setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${data.message}` }]);
              setStreamingContent('');
            }
          } catch (e) {
            console.error('Parse error:', e, 'Line:', line);
          }
        }
      }
    } catch (error) {
      console.error('Fetch error:', error);
      if (error.name === 'AbortError') {
        setStreamingContent('');
      } else {
        const errorMsg = error instanceof Error ? error.message : 'Could not reach the AI. Check that Claude is running locally.';
        setMessages(prev => [...prev, { role: 'assistant', content: errorMsg }]);
      }
    } finally {
      setLoading(false);
      setStreamingContent('');
      streamAbortRef.current = null;
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const unread = !open && messages.length > 0 && messages[messages.length - 1]?.role === 'assistant';

  return (
    <div className={styles.root}>
      {open && (
        <div className={styles.panel}>
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <div className={styles.headerIcon}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.42-1.42M17.66 6.34l1.42-1.42"/>
                </svg>
              </div>
              <div>
                <div className={styles.headerTitle}>AI Assistant</div>
                <div className={styles.headerSub}>Powered by Claude</div>
              </div>
            </div>
            <div className={styles.headerActions}>
              {messages.length > 0 && (
                <button
                  className={styles.clearBtn}
                  onClick={() => setMessages([])}
                  title="Clear conversation"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </button>
              )}
              <button className={styles.closeBtn} onClick={() => setOpen(false)} title="Close">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className={styles.messages}>
            {messages.length === 0 && (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <div className={styles.emptyTitle}>Ask me anything</div>
                <div className={styles.emptyHints}>
                  <span>Summarize my tasks</span>
                  <span>Help me prioritize</span>
                  <span>Draft a status update</span>
                </div>
              </div>
            )}
            {messages.map((m, i) => <Message key={i} msg={m} />)}
            {loading && (
              <div className={`${styles.msgRow} ${styles.msgRowAI}`}>
                <div className={styles.avatar}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.42-1.42M17.66 6.34l1.42-1.42"/>
                  </svg>
                </div>
                <div className={`${styles.bubble} ${styles.bubbleAI}`}>
                  {streamingContent ? (
                    <>
                      <div className={styles.md}>
                        <ReactMarkdown
                          components={{
                            a: ({ node, ...props }) => (
                              <a {...props} target="_blank" rel="noopener noreferrer" />
                            ),
                          }}
                        >
                          {streamingContent}
                        </ReactMarkdown>
                      </div>
                      <span className={styles.streamCursor} />
                    </>
                  ) : (
                    <TypingDots />
                  )}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className={styles.inputRow}>
            <textarea
              ref={inputRef}
              className={styles.input}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Message AI…"
              rows={1}
              disabled={loading}
            />
            {loading ? (
              <button
                className={styles.sendBtn}
                onClick={() => {
                  if (streamAbortRef.current) {
                    streamAbortRef.current.abort();
                  }
                }}
                title="Cancel (Esc)"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            ) : (
              <button
                className={styles.sendBtn}
                onClick={send}
                disabled={!input.trim()}
                title="Send (Enter)"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        className={`${styles.fab} ${open ? styles.fabOpen : ''}`}
        onClick={() => setOpen(o => !o)}
        title={open ? 'Close assistant' : 'Open AI assistant'}
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        )}
        {unread && <span className={styles.unreadDot} />}
      </button>
    </div>
  );
}
