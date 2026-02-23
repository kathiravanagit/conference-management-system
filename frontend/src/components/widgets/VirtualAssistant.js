import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './VirtualAssistant.css';

const BOT_NAME = 'KatBot';

const CATEGORY_COLORS = {
    general: { bg: '#3b82f6', label: 'General' },
    registration: { bg: '#8b5cf6', label: 'Registration' },
    conference: { bg: '#0ea5e9', label: 'Conference' },
    certificate: { bg: '#f59e0b', label: 'Certificate' },
    meeting: { bg: '#10b981', label: 'Meeting' },
    leaderboard: { bg: '#ec4899', label: 'Leaderboard' },
    account: { bg: '#6366f1', label: 'Account' },
    staff: { bg: '#ef4444', label: 'Staff' },
};

// ─── SVG Icon components ────────────────────────────────────────────────────
const ChatIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
    </svg>
);

const CloseIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

const SendIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
);

const BotAvatar = () => (
    <div className="va-avatar-wrapper">
        <img src="/logo.png" alt="KatBot Logo" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
    </div>
);

const VirtualAssistant = () => {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState([
        {
            from: 'bot',
            text: `Hello! I'm **${BOT_NAME}**, your ConferenceHub assistant.\nHow can I help you today?`,
            time: new Date(),
        },
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(true);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        axios.get('/api/assistant/suggestions')
            .then((res) => { if (res.data.success) setSuggestions(res.data.suggestions.slice(0, 5)); })
            .catch(() => { });
    }, []);

    useEffect(() => {
        if (open) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, open]);

    useEffect(() => {
        if (open) setTimeout(() => inputRef.current?.focus(), 250);
    }, [open]);

    const sendMessage = async (text) => {
        const q = (text || input).trim();
        if (!q) return;
        setInput('');
        setShowSuggestions(false);
        setMessages((prev) => [...prev, { from: 'user', text: q, time: new Date() }]);
        setLoading(true);

        const lowerQ = q.toLowerCase();

        // Fast LLM-like responses for common inputs
        const greetings = ['hi', 'hello', 'hey', 'hi katbot', 'hello katbot'];
        if (greetings.includes(lowerQ)) {
            setTimeout(() => {
                setMessages((prev) => [
                    ...prev,
                    { from: 'bot', text: 'Hello there! How can I assist you today?', category: 'general', time: new Date() },
                ]);
                setLoading(false);
            }, 300);
            return;
        }

        if (lowerQ.includes('how are you')) {
            setTimeout(() => {
                setMessages((prev) => [
                    ...prev,
                    { from: 'bot', text: "I'm doing great, thanks for asking! I'm here to help you navigate ConferenceHub.", category: 'general', time: new Date() },
                ]);
                setLoading(false);
            }, 300);
            return;
        }

        if (lowerQ.includes('who are you') || lowerQ.includes('what are you')) {
            setTimeout(() => {
                setMessages((prev) => [
                    ...prev,
                    { from: 'bot', text: `I am **${BOT_NAME}**, your dedicated AI assistant. I can help answer questions about registration, schedules, and more!`, category: 'general', time: new Date() },
                ]);
                setLoading(false);
            }, 300);
            return;
        }

        try {
            const res = await axios.post('/api/assistant/ask', { question: q });
            setMessages((prev) => [
                ...prev,
                { from: 'bot', text: res.data.answer, category: res.data.category, time: new Date() },
            ]);
        } catch {
            setMessages((prev) => [
                ...prev,
                { from: 'bot', text: 'Connection error. Please try again shortly.', time: new Date() },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleKey = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    };

    const formatTime = (d) =>
        new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const renderText = (text) =>
        text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
            i % 2 === 1 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>
        );

    return (
        <>
            {/* ── Floating toggle button ── */}
            <button
                className={`va-toggle ${open ? 'va-toggle--open' : ''}`}
                onClick={() => setOpen((o) => !o)}
                aria-label="Toggle KatBot assistant"
                title={open ? 'Close KatBot' : 'Ask KatBot'}
            >
                {open ? <CloseIcon /> : <ChatIcon />}
                {!open && <span className="va-dot-pulse" />}
            </button>

            {/* ── Chat window ── */}
            {open && (
                <div className="va-window">

                    {/* Header */}
                    <div className="va-header">
                        <BotAvatar />
                        <div className="va-header-info">
                            <p className="va-header-name">{BOT_NAME}</p>
                            <div className="va-header-status">
                                <span className="va-status-dot" />
                                Online
                            </div>
                        </div>
                        <button className="va-close-btn" onClick={() => setOpen(false)} aria-label="Close">
                            <CloseIcon />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="va-messages">

                        {messages.map((msg, i) => (
                            <div key={i} className={`va-msg va-msg--${msg.from}`}>
                                {msg.from === 'bot' && <BotAvatar />}
                                <div className="va-bubble-wrap">
                                    {msg.from === 'bot' && msg.category && CATEGORY_COLORS[msg.category] && (
                                        <span
                                            className="va-cat-tag"
                                            style={{ background: CATEGORY_COLORS[msg.category].bg }}
                                        >
                                            {CATEGORY_COLORS[msg.category].label}
                                        </span>
                                    )}
                                    <div className={`va-bubble va-bubble--${msg.from}`}>
                                        <p>{renderText(msg.text)}</p>
                                    </div>
                                    <span className={`va-time va-time--${msg.from}`}>{formatTime(msg.time)}</span>
                                </div>
                            </div>
                        ))}

                        {/* Typing indicator */}
                        {loading && (
                            <div className="va-msg va-msg--bot">
                                <BotAvatar />
                                <div className="va-bubble-wrap">
                                    <div className="va-bubble va-bubble--bot va-typing">
                                        <span /><span /><span />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Suggestion chips */}
                        {showSuggestions && suggestions.length > 0 && (
                            <div className="va-suggestions">
                                <p className="va-suggestions-label">Suggested questions</p>
                                <div className="va-chips">
                                    {suggestions.map((s, i) => (
                                        <button key={i} className="va-chip" onClick={() => sendMessage(s.question)}>
                                            {s.question}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="va-input-row">
                        <input
                            ref={inputRef}
                            type="text"
                            className="va-input"
                            placeholder="Type your question…"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKey}
                            disabled={loading}
                        />
                        <button
                            className="va-send-btn"
                            onClick={() => sendMessage()}
                            disabled={loading || !input.trim()}
                            aria-label="Send"
                        >
                            <SendIcon />
                        </button>
                    </div>

                </div>
            )}
        </>
    );
};

export default VirtualAssistant;
