"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { openTicketStream, sendTicketMessage } from "@/lib/backend";
import type {
  AuthSession,
  ChatMessage,
  LiveTicketEvent,
  TicketRecord,
} from "@/lib/operations-types";

/* ─── Media encoding ───────────────────────────────────── */
type MediaType = "text" | "voice" | "image" | "video" | "pdf";

function encodeMedia(type: "voice" | "image" | "video" | "pdf", dataUrl: string): string {
  return `[${type.toUpperCase()}:${dataUrl}]`;
}

function parseMessage(raw: string): { type: MediaType; content: string } {
  if (raw.startsWith("[VOICE:") && raw.endsWith("]")) {
    const c = raw.slice(7, -1);
    if (c.startsWith("data:")) return { type: "voice", content: c };
  }
  if (raw.startsWith("[IMAGE:") && raw.endsWith("]")) {
    const c = raw.slice(7, -1);
    if (c.startsWith("data:")) return { type: "image", content: c };
  }
  if (raw.startsWith("[VIDEO:") && raw.endsWith("]")) {
    const c = raw.slice(7, -1);
    if (c.startsWith("data:")) return { type: "video", content: c };
  }
  if (raw.startsWith("[PDF:") && raw.endsWith("]")) {
    const c = raw.slice(5, -1);
    if (c.startsWith("data:")) return { type: "pdf", content: c };
  }
  return { type: "text", content: raw };
}

async function compressImage(file: File, maxPx = 900, quality = 0.78): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(maxPx / img.width, maxPx / img.height, 1);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ─── Helpers ──────────────────────────────────────────── */
function fmtTime(s: string) {
  try { return new Date(s).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }); }
  catch { return ""; }
}

function fmtDate(s: string) {
  const d = new Date(s);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function roleInitial(name: string) {
  return name ? name[0].toUpperCase() : "?";
}

const ROLE_AVATAR_BG: Record<string, string> = {
  admin: "#4B5563",
  logistics: "#1D4ED8",
  operator: "#7E22CE",
  factory_operator: "#7E22CE",
  ingestion: "#B45309",
};

/* ─── SVG Icons (WhatsApp-style) ───────────────────────── */
function IconMic({ size = 20, color = "#54656f" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 1C10.34 1 9 2.34 9 4v7c0 1.66 1.34 3 3 3s3-1.34 3-3V4c0-1.66-1.34-3-3-3z" fill={color} />
      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08C16.39 17.43 19 14.53 19 11h-2z" fill={color} />
    </svg>
  );
}

function IconStop({ size = 20, color = "#ef4444" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function IconAttach({ size = 20, color = "#54656f" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66L9.41 17.41a2 2 0 01-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function IconSend({ size = 20, color = "#ffffff" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill={color} />
    </svg>
  );
}

function IconPlay({ size = 16, color = "#128C7E" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function IconReply({ size = 14, color = "#8696a0" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <polyline points="9,17 4,12 9,7" />
      <path d="M20 18v-2a4 4 0 00-4-4H4" />
    </svg>
  );
}

/* ─── Member avatar colors ─────────────────────────────── */
const ROLE_BG: Record<string, string> = {
  admin: "#4B5563",
  logistics: "#1D4ED8",
  factory_operator: "#7E22CE",
  ingestion: "#B45309",
};

/* ─── Main component ───────────────────────────────────── */
type Props = {
  ticket: TicketRecord;
  session: AuthSession;
  onTicketUpdated: (ticket: TicketRecord) => void;
};

export function TicketChatPanel({ ticket, session, onTicketUpdated }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(ticket.messages ?? []);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  /* Media */
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaPreview, setMediaPreview] = useState<{ type: MediaType; dataUrl: string; fileName?: string } | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const canSend = session.permissions.includes("ticket.message");
  const selfName = session.user.displayName;

  useEffect(() => { setMessages(ticket.messages ?? []); }, [ticket.id, ticket.messages]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  /* WebSocket stream */
  useEffect(() => {
    if (!session.token) return;
    const stream = openTicketStream(
      ticket.id,
      session,
      (ev: LiveTicketEvent) => {
        if (ev.eventType === "new_message" && ev.messageRecord) {
          const r = ev.messageRecord;
          const msg: ChatMessage = {
            id: r.id, author: r.author, role: r.role,
            sentAt: r.sentAt ?? r.sent_at ?? new Date().toISOString(),
            message: r.message,
            replyToMessageId: r.replyToMessageId ?? r.reply_to_message_id ?? null,
            replyToAuthor: r.replyToAuthor ?? r.reply_to_author ?? null,
            replyToExcerpt: r.replyToExcerpt ?? r.reply_to_excerpt ?? null,
          };
          setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
        } else if (ev.ticket) {
          onTicketUpdated(ev.ticket);
        }
      },
      {
        onAuthExpired: () => {
          // surface a user-visible error; AppShell will handle full logout via its own periodic check
          setError("Your session has expired. Please refresh the page to log in again.");
        },
      }
    );
    return () => { stream?.close(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket.id, session.token]);

  const handleSend = useCallback(async () => {
    const body = mediaPreview
      ? encodeMedia(mediaPreview.type as "voice" | "image" | "video" | "pdf", mediaPreview.dataUrl)
      : text.trim();
    if (!body) return;
    setSending(true); setError("");
    try {
      const updated = await sendTicketMessage(ticket.id, body, replyTo?.id ?? null, session);
      if (updated) { setMessages(updated.messages ?? []); onTicketUpdated(updated); }
      setText(""); setReplyTo(null); setMediaPreview(null);
      setTimeout(() => textareaRef.current?.focus(), 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send.");
    } finally { setSending(false); }
  }, [text, replyTo, mediaPreview, ticket.id, session, onTicketUpdated]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const mr = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        stream.getTracks().forEach((t) => t.stop());
        const reader = new FileReader();
        reader.onloadend = () => setMediaPreview({ type: "voice", dataUrl: reader.result as string });
        reader.readAsDataURL(blob);
      };
      mr.start(500);
      mediaRecorderRef.current = mr;
      setRecording(true); setRecordingTime(0);
      recordTimerRef.current = setInterval(() => setRecordingTime((n) => n + 1), 1000);
      setTimeout(() => { if (mediaRecorderRef.current?.state === "recording") stopRecording(); }, 120000);
    } catch { setError("Microphone access denied."); }
  }

  function stopRecording() {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const MAX_MB = file.type === "application/pdf" ? 8 : 10;
    if (file.size > MAX_MB * 1024 * 1024) { setError(`File too large (max ${MAX_MB} MB).`); return; }
    if (file.type.startsWith("image/")) {
      setMediaPreview({ type: "image", dataUrl: await compressImage(file) });
    } else if (file.type.startsWith("video/")) {
      const reader = new FileReader();
      reader.onloadend = () => setMediaPreview({ type: "video", dataUrl: reader.result as string });
      reader.readAsDataURL(file);
    } else if (file.type === "application/pdf") {
      const reader = new FileReader();
      reader.onloadend = () => setMediaPreview({ type: "pdf", dataUrl: reader.result as string, fileName: file.name });
      reader.readAsDataURL(file);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey && !mediaPreview) {
      e.preventDefault();
      void handleSend();
    }
  }

  /* Group by date */
  const grouped: Array<{ date: string; msgs: ChatMessage[] }> = [];
  for (const msg of messages) {
    const d = msg.sentAt.slice(0, 10);
    const last = grouped.at(-1);
    if (last && last.date === d) last.msgs.push(msg);
    else grouped.push({ date: d, msgs: [msg] });
  }

  const statusLabel = ticket.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div style={{
      flex: 1, minWidth: 0, display: "flex", flexDirection: "column",
      overflow: "hidden", background: "#f0f2f5", borderRight: "1px solid var(--border)",
    }}>

      {/* ── WhatsApp-style group header ── */}
      <div style={{
        minHeight: 56, background: "#ffffff", borderBottom: "1px solid #e9edef",
        display: "flex", alignItems: "center", padding: "0 14px", gap: 12, flexShrink: 0,
      }}>
        {/* Stacked member avatars (WhatsApp group style) */}
        <div style={{ position: "relative", width: 40, height: 38, flexShrink: 0 }}>
          {(ticket.members?.length ?? 0) === 0 ? (
            <div style={{
              width: 38, height: 38, borderRadius: "50%",
              background: "#128C7E", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff",
            }}>
              {roleInitial(ticket.teamName)}
            </div>
          ) : (
            ticket.members.slice(0, 3).map((m, i) => (
              <div
                key={m.email}
                title={`${m.displayName} (${m.role})`}
                style={{
                  position: "absolute",
                  left: i * 10,
                  top: i === 1 ? 8 : 0,
                  width: 26, height: 26, borderRadius: "50%",
                  background: ROLE_BG[m.role] ?? "#667781",
                  border: "2px solid #fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 700, color: "#fff",
                  zIndex: 3 - i,
                }}
              >
                {m.displayName[0]?.toUpperCase() ?? "?"}
              </div>
            ))
          )}
        </div>

          <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#111b21", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {ticket.teamName}
          </div>
          <div style={{ fontSize: 11, color: "#667781", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {(ticket.members?.length ?? 0) > 0
              ? ticket.members.map((m) => m.displayName).join(", ")
              : `${ticket.factoryName} · ${ticket.title.slice(0, 35)}`}
            {ticket.assignedToName && (
              <span style={{ marginLeft: 6, padding: "0 5px", background: "#dbeafe", color: "#1d4ed8", borderRadius: 8, fontSize: 10, fontWeight: 600 }}>
                {ticket.assignedToName}
              </span>
            )}
          </div>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 600, padding: "3px 8px",
          background: "#e9edef", color: "#667781",
          borderRadius: 12, flexShrink: 0, letterSpacing: "0.02em",
          textTransform: "uppercase",
        }}>
          {statusLabel}
        </span>
      </div>

      {/* ── Messages area ── */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "12px 5%",
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d9dde1' fill-opacity='0.18'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }}>
        {messages.length === 0 && (
          <div style={{ display: "flex", justifyContent: "center", padding: "32px 0" }}>
            <div style={{
              background: "rgba(255,255,255,0.85)", padding: "10px 18px",
              borderRadius: 12, fontSize: 12, color: "#667781", textAlign: "center",
              maxWidth: 260, lineHeight: 1.6,
            }}>
              No messages yet.<br />
              Start the conversation about this deployment request.
            </div>
          </div>
        )}

        {grouped.map(({ date, msgs }) => (
          <div key={date}>
            {/* Date pill */}
            <div style={{ display: "flex", justifyContent: "center", margin: "8px 0 12px" }}>
              <span style={{
                background: "#ffffff", color: "#667781", fontSize: 11,
                padding: "4px 12px", borderRadius: 12, boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
              }}>
                {fmtDate(date)}
              </span>
            </div>

            {msgs.map((msg, i) => {
              const prev = i > 0 ? msgs[i - 1] : null;
              const isSelf = msg.author === selfName || msg.author === session.user.email;
              const isSystem = msg.message.startsWith("[system]");
              const showSender = !isSelf && (!prev || prev.author !== msg.author);
              const parsed = parseMessage(msg.message);
              const isConsecutive = prev?.author === msg.author && !isSystem;

              if (isSystem) {
                return (
                  <div key={msg.id} style={{ display: "flex", justifyContent: "center", margin: "4px 0" }}>
                    <span style={{
                      background: "#fffde7", color: "#856404", fontSize: 11,
                      padding: "4px 14px", borderRadius: 12,
                      boxShadow: "0 1px 1px rgba(0,0,0,0.08)",
                    }}>
                      {msg.message.replace("[system] ", "")}
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  style={{
                    display: "flex", justifyContent: isSelf ? "flex-end" : "flex-start",
                    marginBottom: isConsecutive ? 2 : 6, position: "relative",
                  }}
                  onDoubleClick={() => setReplyTo(msg)}
                >
                  {/* Avatar for others (first in group) */}
                  {!isSelf && (
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                      background: ROLE_AVATAR_BG[msg.role] ?? "#667781",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 700, color: "#fff",
                      marginRight: 6, marginTop: "auto",
                      visibility: showSender || !isConsecutive ? "visible" : "hidden",
                    }}>
                      {roleInitial(msg.author)}
                    </div>
                  )}

                  {/* Bubble */}
                  <div style={{
                    maxWidth: "70%", minWidth: 80,
                    background: isSelf ? "#d9fdd3" : "#ffffff",
                    borderRadius: isSelf
                      ? (isConsecutive ? "18px 4px 4px 18px" : "18px 4px 18px 18px")
                      : (isConsecutive ? "4px 18px 18px 4px" : "4px 18px 18px 18px"),
                    padding: "6px 10px 4px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                    position: "relative",
                  }}>
                    {/* Sender name */}
                    {showSender && (
                      <div style={{
                        fontSize: 11, fontWeight: 700, marginBottom: 2,
                        color: ROLE_AVATAR_BG[msg.role] ?? "#128C7E",
                      }}>
                        {msg.author}
                      </div>
                    )}

                    {/* Reply-to */}
                    {msg.replyToAuthor && (
                      <div style={{
                        borderLeft: `3px solid ${isSelf ? "#128C7E" : "#53bdeb"}`,
                        paddingLeft: 6, marginBottom: 4,
                        background: isSelf ? "rgba(18,140,126,0.1)" : "#f0f2f5",
                        borderRadius: "0 4px 4px 0",
                        padding: "3px 6px",
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: isSelf ? "#128C7E" : "#53bdeb" }}>
                          {msg.replyToAuthor}
                        </div>
                        <div style={{ fontSize: 11, color: "#667781", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>
                          {msg.replyToExcerpt}
                        </div>
                      </div>
                    )}

                    {/* Content */}
                    {parsed.type === "text" && (
                      <div style={{ fontSize: 13.5, color: "#111b21", lineHeight: 1.5, wordBreak: "break-word" }}>
                        {parsed.content}
                      </div>
                    )}

                    {parsed.type === "voice" && (
                      <VoicePlayer src={parsed.content} isSelf={isSelf} author={msg.author} />
                    )}

                    {parsed.type === "image" && (
                      <div style={{ cursor: "pointer" }} onClick={() => setLightbox(parsed.content)}>
                        <img
                          src={parsed.content} alt="Image"
                          style={{
                            maxWidth: 240, maxHeight: 240, display: "block",
                            borderRadius: 8, marginBottom: 2,
                          }}
                        />
                      </div>
                    )}

                    {parsed.type === "video" && (
                      <video
                        src={parsed.content} controls preload="metadata"
                        style={{ maxWidth: 240, maxHeight: 180, display: "block", borderRadius: 8 }}
                      />
                    )}

                    {parsed.type === "pdf" && (
                      <a
                        href={parsed.content}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "10px 12px", textDecoration: "none",
                          background: isSelf ? "rgba(18,140,126,0.08)" : "#f0f2f5",
                          borderRadius: 8, minWidth: 180, maxWidth: 240,
                        }}
                      >
                        <div style={{
                          width: 36, height: 36, borderRadius: 6, flexShrink: 0,
                          background: "#dc2626", display: "flex", alignItems: "center",
                          justifyContent: "center",
                        }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" fill="white" opacity="0.9"/>
                            <path d="M14 2v6h6" stroke="white" strokeWidth="1.5" fill="none"/>
                            <text x="5" y="18" fontSize="6" fill="white" fontWeight="bold">PDF</text>
                          </svg>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#111b21", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            Document
                          </div>
                          <div style={{ fontSize: 10, color: "#667781" }}>Tap to open PDF</div>
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#667781" strokeWidth="2">
                          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                          <polyline points="15,3 21,3 21,9"/>
                          <line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                      </a>
                    )}

                    {/* Timestamp */}
                    <div style={{
                      display: "flex", justifyContent: "flex-end",
                      gap: 3, marginTop: 2, alignItems: "center",
                    }}>
                      <span style={{ fontSize: 10, color: "#667781", whiteSpace: "nowrap" }}>
                        {fmtTime(msg.sentAt)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* ── Composer ── */}
      {canSend ? (
        <div style={{ background: "#f0f2f5", flexShrink: 0 }}>
          {/* Reply banner */}
          {replyTo && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "#ffffff", padding: "6px 14px",
              borderTop: "1px solid #e9edef",
            }}>
              <IconReply />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#128C7E" }}>{replyTo.author}</div>
                <div style={{ fontSize: 11, color: "#667781", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {replyTo.message.slice(0, 80)}
                </div>
              </div>
              <button onClick={() => setReplyTo(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#8696a0", fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
          )}

          {/* Media preview */}
          {mediaPreview && (
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "#ffffff", padding: "8px 14px", borderTop: "1px solid #e9edef",
            }}>
              {mediaPreview.type === "image" && (
                <img src={mediaPreview.dataUrl} alt="Preview" style={{ height: 60, width: 60, objectFit: "cover", borderRadius: 6 }} />
              )}
              {mediaPreview.type === "video" && (
                <video src={mediaPreview.dataUrl} style={{ height: 60, width: 80, objectFit: "cover", borderRadius: 6 }} />
              )}
              {mediaPreview.type === "voice" && (
                <audio controls src={mediaPreview.dataUrl} style={{ height: 32, flex: 1 }} />
              )}
              {mediaPreview.type === "pdf" && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 6, background: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 10, color: "#fff", fontWeight: 800 }}>PDF</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#111b21" }}>{mediaPreview.fileName ?? "Document.pdf"}</div>
                    <div style={{ fontSize: 10, color: "#667781" }}>Ready to send</div>
                  </div>
                </div>
              )}
              {mediaPreview.type !== "voice" && mediaPreview.type !== "pdf" && (
                <div style={{ flex: 1, fontSize: 12, color: "#667781" }}>
                  {mediaPreview.type === "image" ? "Photo ready to send" : "Video ready to send"}
                </div>
              )}
              <button onClick={() => setMediaPreview(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#8696a0", fontSize: 20, lineHeight: 1 }}>×</button>
            </div>
          )}

          {/* Recording bar */}
          {recording && (
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 14px", background: "#fff",
              borderTop: "1px solid #e9edef",
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", animation: "pulse 1s infinite", flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: "#111b21", flex: 1 }}>
                Recording... {Math.floor(recordingTime / 60).toString().padStart(2, "0")}:{(recordingTime % 60).toString().padStart(2, "0")}
              </span>
              <button onClick={stopRecording} style={{
                background: "#ef4444", border: "none", borderRadius: "50%",
                width: 36, height: 36, cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center",
              }}>
                <IconStop size={16} color="#fff" />
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ padding: "4px 14px", background: "#fef2f2", borderTop: "1px solid #fecaca" }}>
              <span style={{ fontSize: 11, color: "#dc2626" }}>{error}</span>
            </div>
          )}

          {/* Input row */}
          <div style={{
            display: "flex", alignItems: "flex-end", gap: 8,
            padding: "8px 10px",
          }}>
            {/* Attach */}
            {!recording && !mediaPreview && (
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  padding: 8, display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}
                title="Attach photo or video"
              >
                <IconAttach />
              </button>
            )}

            {/* Text input */}
            {!recording && !mediaPreview && (
              <div style={{
                flex: 1, background: "#ffffff", borderRadius: 24,
                padding: "6px 14px", display: "flex", alignItems: "flex-end",
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              }}>
                <textarea
                  ref={textareaRef}
                  placeholder="Type a message"
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                  }}
                  onKeyDown={handleKeyDown}
                  disabled={sending}
                  rows={1}
                  style={{
                    flex: 1, border: "none", outline: "none", resize: "none",
                    fontSize: 14, lineHeight: 1.5, background: "transparent",
                    color: "#111b21", maxHeight: 120, overflowY: "auto",
                    fontFamily: "var(--font-ui)",
                  }}
                />
              </div>
            )}

            {/* Media-only: spacer */}
            {(recording || mediaPreview) && !mediaPreview && <div style={{ flex: 1 }} />}
            {mediaPreview && <div style={{ flex: 1 }} />}

            {/* Voice / Stop / Send */}
            {!mediaPreview ? (
              recording ? (
                // while recording, stop button is in the bar above; show cancel
                <button
                  onClick={() => { stopRecording(); }}
                  style={{
                    background: "#ef4444", border: "none", borderRadius: "50%",
                    width: 44, height: 44, cursor: "pointer", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <IconStop size={18} color="#fff" />
                </button>
              ) : text.trim() ? (
                <button
                  onClick={() => void handleSend()}
                  disabled={sending}
                  style={{
                    background: "#128C7E", border: "none", borderRadius: "50%",
                    width: 44, height: 44, cursor: "pointer", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  {sending
                    ? <span className="spinner" style={{ borderTopColor: "#fff", width: 18, height: 18 }} />
                    : <IconSend />}
                </button>
              ) : (
                <button
                  onMouseDown={(e) => { e.preventDefault(); void startRecording(); }}
                  style={{
                    background: "#128C7E", border: "none", borderRadius: "50%",
                    width: 44, height: 44, cursor: "pointer", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                  title="Hold to record voice message"
                >
                  <IconMic size={20} color="#fff" />
                </button>
              )
            ) : (
              <button
                onClick={() => void handleSend()}
                disabled={sending}
                style={{
                  background: "#128C7E", border: "none", borderRadius: "50%",
                  width: 44, height: 44, cursor: "pointer", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                {sending
                  ? <span className="spinner" style={{ borderTopColor: "#fff", width: 18, height: 18 }} />
                  : <IconSend />}
              </button>
            )}
          </div>

          <input ref={fileInputRef} type="file" accept="image/*,video/*,application/pdf" style={{ display: "none" }} onChange={handleFile} />
        </div>
      ) : (
        <div style={{
          padding: "12px 16px", background: "#f0f2f5",
          borderTop: "1px solid #e9edef", textAlign: "center",
          fontSize: 12, color: "#8696a0",
        }}>
          You cannot send messages on this ticket.
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)",
            zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <img src={lightbox} alt="Full size" style={{ maxWidth: "92vw", maxHeight: "90vh", objectFit: "contain" }} />
          <button onClick={() => setLightbox(null)} style={{
            position: "absolute", top: 16, right: 16, background: "none",
            border: "none", color: "#fff", fontSize: 28, cursor: "pointer",
          }}>×</button>
        </div>
      )}
    </div>
  );
}

/* ─── Voice Player ─────────────────────────────────────── */
function VoicePlayer({ src, isSelf }: { src: string; isSelf: boolean; author: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { void a.play(); setPlaying(true); }
  }

  const barColor = isSelf ? "#128C7E" : "#8696a0";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 180, paddingRight: 4 }}>
      <audio
        ref={audioRef} src={src} preload="metadata"
        onEnded={() => { setPlaying(false); setProgress(0); }}
        onTimeUpdate={() => {
          const a = audioRef.current;
          if (a && a.duration) setProgress(a.currentTime / a.duration);
        }}
        onLoadedMetadata={() => {
          const a = audioRef.current;
          if (a) setDuration(a.duration);
        }}
        style={{ display: "none" }}
      />
      <button
        onClick={toggle}
        style={{
          width: 34, height: 34, borderRadius: "50%", border: "none",
          background: isSelf ? "#128C7E" : "#8696a0", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}
      >
        {playing
          ? <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
          : <IconPlay size={14} color="#fff" />}
      </button>
      {/* Waveform bars */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 2, height: 28 }}>
        {Array.from({ length: 28 }).map((_, i) => {
          const h = 4 + Math.sin(i * 0.8) * 8 + Math.cos(i * 1.3) * 5;
          const filled = i / 28 <= progress;
          return (
            <div key={i} style={{
              width: 2.5, height: Math.max(4, h),
              background: filled ? barColor : (isSelf ? "#93c4bd" : "#c8d0d8"),
              borderRadius: 2, flexShrink: 0,
              transition: "background 0.1s",
            }} />
          );
        })}
      </div>
      <span style={{ fontSize: 10, color: "#8696a0", whiteSpace: "nowrap", minWidth: 30 }}>
        {duration > 0
          ? `${Math.floor(duration / 60)}:${Math.floor(duration % 60).toString().padStart(2, "0")}`
          : "0:00"}
      </span>
    </div>
  );
}
