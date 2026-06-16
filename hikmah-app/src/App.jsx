import React, { useState, useEffect } from "react";
import {
  Brain,
  Search,
  AlertCircle,
  Menu,
  X,
  Plus,
  MessageSquare,
  Send,
  Quote,
  Trash2,
  MoreHorizontal,
  Pencil,
} from "lucide-react";

export default function App() {
  // Application State
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasAsked, setHasAsked] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const response = await fetch("http://localhost:3001/sessions/");
      const data = await response.json();
      setSessions(data);
    } catch (error) {
      console.error("Error loading sessions:", error);
    }
  };

  const deleteSession = async (e, id) => {
    e.stopPropagation();
    setOpenMenuId(null);
    await fetch(`http://localhost:3001/sessions/${id}`, { method: "DELETE" });
    if (sessionId === id) handleNewChat();
    loadSessions();
  };

  const startRename = (e, session) => {
    e.stopPropagation();
    setOpenMenuId(null);
    setRenamingId(session.id);
    setRenameValue(session.title);
  };

  const submitRename = async (id) => {
    if (!renameValue.trim()) return;
    await fetch(`http://localhost:3001/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: renameValue }),
    });
    setRenamingId(null);
    loadSessions();
  };

  const loadSession = async (id) => {
    setSessionId(id);
    setHasAsked(true);
    setIsSidebarOpen(false);

    try {
      const resoponse = await fetch(
        `http://localhost:3001/sessions/${id}/messages`,
      );
      const msgs = await resoponse.json();
      if (msgs.length > 0) {
        setSubmittedQuery(msgs[msgs.length - 1].question);
        setMessages(
          msgs.map((m) => ({
            question: m.question,
            summary: m.summary,
            quran: m.quran,
            hadith: m.hadith,
          })),
        );
      }
    } catch (error) {
      console.error("Error loading session messages:", error);
    }
  };

  // Simulate AI search submission
  const handleAsk = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    const currentQuestion = query;
    setIsLoading(true);
    setHasAsked(true);
    setSubmittedQuery(currentQuestion);
    setQuery("");

    try {
      const response = await fetch("http://localhost:3001/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: currentQuestion,
          session_id: sessionId,
        }),
      });
      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        {
          question: currentQuestion,
          summary: data.summary,
          quran: data.quran,
          hadith: data.hadith,
        },
      ]);
      setSessionId(data.session_id);
      loadSessions();
    } catch (error) {
      console.error("Error fetching ayah:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset to new chat
  const handleNewChat = () => {
    setQuery("");
    setHasAsked(false);
    setIsSidebarOpen(false);
    setSessionId(null);
    setMessages([]);
  };

  return (
    <div
      className="flex h-screen bg-[#F5F7F2] text-gray-800 overflow-hidden"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* 1. Sidebar (Desktop & Mobile) */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside
        className={`
        fixed md:static inset-y-0 left-0 z-50 w-64 bg-[#2D5016] text-[#F5F7F2] flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}
      >
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-base">
            <span>Hikmah AI</span>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden p-1 hover:bg-[#3a6b1e] rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 pb-4">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center gap-2 px-3 py-2.5 bg-[#3a6b1e] hover:bg-[#478224] rounded-xl text-sm font-medium transition-colors border border-[#F5F7F2]/10"
          >
            <Plus className="w-4 h-4 text-[#8BC34A]" />
            Sembang Baru
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1 custom-scrollbar">
          <p className="text-[11px] font-semibold text-[#F5F7F2]/50 uppercase tracking-wider mb-2 px-2">
            Sejarah Sembang
          </p>
          {sessions.map((session) => (
            <div
              key={session.id}
              className="group relative flex items-center gap-1"
            >
              {renamingId === session.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => submitRename(session.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitRename(session.id);
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                  className="flex-1 px-3 py-2 text-[13px] bg-[#3a6b1e] text-white rounded-lg outline-none border border-[#8BC34A]/50"
                />
              ) : (
                <button
                  onClick={() => setSessionId(session.id)}
                  onClick={() => loadSession(session.id)}
                  className={`flex-1 flex items-center gap-3 px-3 py-2 text-[13px] text-left rounded-lg transition-colors min-w-0 ${sessionId === session.id ? "bg-[#3a6b1e] text-white" : "hover:bg-[#3a6b1e] text-[#F5F7F2]/80 hover:text-white"}`}
                >
                  <MessageSquare className="w-3.5 h-3.5 shrink-0 text-[#8BC34A]/70" />
                  <span className="truncate">{session.title}</span>
                </button>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenuId(openMenuId === session.id ? null : session.id);
                }}
                className="shrink-0 p-1.5 opacity-0 group-hover:opacity-100 hover:bg-[#3a6b1e] rounded-lg transition-all"
              >
                <MoreHorizontal className="w-3.5 h-3.5 text-[#F5F7F2]/70" />
              </button>

              {openMenuId === session.id && (
                <div className="absolute right-0 top-8 z-50 bg-white rounded-xl shadow-lg border border-gray-100 py-1 w-36">
                  <button
                    onClick={(e) => startRename(e, session)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-gray-700 hover:bg-gray-50"
                  >
                    <Pencil className="w-3.5 h-3.5 text-gray-400" />
                    Rename
                  </button>
                  <button
                    onClick={(e) => deleteSession(e, session.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-[#F5F7F2]/10">
          <div className="flex items-start gap-2 px-2 py-2 text-[11px] text-[#F5F7F2]/60 bg-[#1e3a0e] rounded-lg">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#8BC34A]" />
            <p>Rujukan umum sahaja. Bukan fatwa rasmi.</p>
          </div>
        </div>
      </aside>

      {/* 2. Main Content Area */}
      <main className="flex-1 flex flex-col h-full relative">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 bg-[#F5F7F2] border-b border-gray-200/50 sticky top-0 z-30">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 text-[#2D5016]"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold text-sm text-[#2D5016]">Hikmah AI</span>
          <div className="w-5" />
        </header>

        {/* Scrollable Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 w-full scroll-smooth">
          <div className="max-w-3xl mx-auto w-full pb-8">
            {/* Empty State */}
            {!hasAsked && (
              <div className="h-full flex flex-col items-center justify-center pt-24 pb-10 text-center animate-in fade-in duration-700">
                <div className="w-20 h-20 bg-white rounded-2xl shadow-sm border border-[#2D5016]/10 flex items-center justify-center mb-6">
                  <img
                    src="/Hikmah_AI_logo_2.png"
                    alt="Hikmah AI"
                    className="w-20 h-20 object-contain"
                  />
                </div>
                <h1 className="text-3xl md:text-4xl font-extrabold text-[#2D5016] mb-3 tracking-tight">
                  Sedia Membantu Anda
                </h1>
                <p className="text-sm md:text-base text-gray-500 mb-8 max-w-md">
                  Tanya sebarang soalan berkaitan wakaf, sedekah, fidyah, dan
                  pengurusan harta dalam Islam.
                </p>
              </div>
            )}

            {/* User Message & AI Response */}
            {hasAsked && (
              <div className="space-y-6">
                {messages.map((msg, index) => (
                  <div key={index} className="space-y-5">
                    {/* User Bubble */}
                    <div className="flex justify-end mb-2">
                      <div className="bg-[#2D5016] text-white px-5 py-3 rounded-2xl rounded-tr-sm max-w-[85%] shadow-sm">
                        <p className="text-sm md:text-base">{msg.question}</p>
                      </div>
                    </div>

                    {/* AI Response */}
                    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-50">
                          <div className="p-2 bg-[#F5F7F2] rounded-lg">
                            <Brain className="w-5 h-5 text-[#2D5016]" />
                          </div>
                          <h2 className="text-base md:text-lg font-bold text-[#2D5016]">
                            Ringkasan Jawapan
                          </h2>
                        </div>
                        <p className="text-gray-700 leading-relaxed text-sm md:text-base">
                          {msg.summary}
                        </p>
                      </div>

                      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
                          <Quote className="w-4 h-4 text-[#8BC34A]" />
                          <h3 className="font-semibold text-sm md:text-base text-[#2D5016]">
                            Sumber Rujukan (Dalil)
                          </h3>
                        </div>
                        <div className="p-5 md:p-6 space-y-6">
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <span className="px-2 py-0.5 bg-[#2D5016]/10 text-[#2D5016] rounded text-[10px] font-bold uppercase tracking-wider">
                                Al-Quran
                              </span>
                              <h4 className="font-semibold text-[13px] md:text-sm text-gray-800">
                                {msg.quran
                                  ? `${msg.quran.surah} : ${msg.quran.verse}`
                                  : ""}
                              </h4>
                            </div>
                            <p
                              className="text-right text-xl md:text-2xl mb-3 text-gray-800 leading-loose"
                              dir="rtl"
                            >
                              {msg.quran ? msg.quran.arabic : ""}
                            </p>
                            <p className="text-gray-600 italic leading-relaxed text-[13px] md:text-sm border-l-4 border-[#8BC34A] pl-4 bg-[#F5F7F2]/50 py-2.5 pr-3 rounded-r-lg">
                              {msg.quran ? msg.quran.malay : ""}
                            </p>
                          </div>
                          <hr className="border-gray-100" />
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <span className="px-2 py-0.5 bg-[#8BC34A]/10 text-[#5a8a1e] rounded text-[10px] font-bold uppercase tracking-wider">
                                Hadis
                              </span>
                              <h4 className="font-semibold text-[13px] md:text-sm text-gray-800">
                                {msg.hadith ? msg.hadith.source : ""}
                              </h4>
                            </div>
                            <p
                              className="text-right text-base mb-3 text-gray-800 leading-loose"
                              dir="rtl"
                            >
                              {msg.hadith ? msg.hadith.arabic : ""}
                            </p>
                            <p className="text-gray-600 italic leading-relaxed text-[13px] md:text-sm border-l-4 border-[#2D5016] pl-4 bg-[#F5F7F2]/50 py-2.5 pr-3 rounded-r-lg">
                              {msg.hadith ? msg.hadith.malay : ""}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-center gap-3 text-[#2D5016] p-4">
                    <div className="w-6 h-6 border-[3px] border-[#8BC34A]/30 border-t-[#2D5016] rounded-full animate-spin"></div>
                    <p className="text-sm font-medium animate-pulse">
                      Menyemak sumber rujukan...
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 3. Fixed Bottom Input Area */}
        <div className="p-4 bg-gradient-to-t from-[#F5F7F2] via-[#F5F7F2] to-transparent shrink-0 pb-6">
          <form onSubmit={handleAsk} className="max-w-3xl mx-auto relative">
            <input
              type="text"
              className="w-full pl-5 pr-14 py-3.5 rounded-2xl border border-gray-200 focus:outline-none focus:border-[#2D5016] focus:ring-4 focus:ring-[#2D5016]/10 text-sm md:text-base transition-all bg-white shadow-sm"
              placeholder="Tanya soalan kepada Hikmah AI..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              type="submit"
              disabled={!query.trim() || isLoading}
              className="absolute right-1.5 top-1.5 bottom-1.5 aspect-square flex items-center justify-center bg-[#2D5016] hover:bg-[#3a6b1e] text-white rounded-xl transition-colors disabled:opacity-50 disabled:hover:bg-[#2D5016]"
            >
              <Send className="w-4 h-4 -ml-0.5" />
            </button>
          </form>
          <p className="text-center text-[11px] text-gray-400 mt-2.5">
            Hikmah AI mungkin memberikan maklumat yang kurang tepat. Sila rujuk
            ustaz atau pakar agama untuk kepastian.
          </p>
        </div>
      </main>
    </div>
  );
}
