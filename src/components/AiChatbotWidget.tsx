import React, { useState, useEffect, useRef } from "react";
import { AiConfig, ChatMessage, User, Location, Itinerary } from "../types";
import { AiService } from "../lib/aiService";
import { isDefaultAdminUtama } from "../data";
import { AiConfigModal } from "./AiConfigModal";
import {
  Sparkles,
  Send,
  Bot,
  User as UserIcon,
  Settings,
  Minimize2,
  Trash2,
  Key,
  MessageSquare,
  AlertCircle,
  RefreshCw,
  Compass,
  MapPin,
  Utensils
} from "lucide-react";

const SUGGESTED_PROMPTS = [
  { icon: Compass, text: "Pantai mana yang paling wajib dikunjungi di Pacitan?" },
  { icon: MapPin, text: "Buatkan contoh rencana perjalanan / itinerari 2 hari 1 malam di Pacitan" },
  { icon: Utensils, text: "Apa saja kuliner khas Pacitan yang wajib saya coba?" },
  { icon: Sparkles, text: "Berapa estimasi tiket masuk ke Pantai Klayar dan Goa Gong?" }
];

interface AiChatbotWidgetProps {
  currentUser?: User;
  locations?: Location[];
  itineraries?: Itinerary[];
  onSaveItinerary?: (itinerary: Itinerary) => void;
}

export const AiChatbotWidget: React.FC<AiChatbotWidgetProps> = ({
  currentUser,
  locations = [],
  itineraries = [],
  onSaveItinerary
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [config, setConfig] = useState<AiConfig>(AiService.getConfig());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isAdminUtama = currentUser ? isDefaultAdminUtama(currentUser.email, currentUser.name, currentUser.id) : false;

  // Helper to parse potential itinerary actions
  const parseItineraryAction = (content: string) => {
    const startTag = "[ITINERARY_ACTION]";
    const endTag = "[/ITINERARY_ACTION]";
    const startIndex = content.indexOf(startTag);
    const endIndex = content.indexOf(endTag);

    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      const jsonStr = content.substring(startIndex + startTag.length, endIndex).trim();
      const cleanContent = (content.substring(0, startIndex) + content.substring(endIndex + endTag.length)).trim();
      try {
        const actionData = JSON.parse(jsonStr);
        return { cleanContent, actionData };
      } catch (e) {
        console.error("Gagal memproses JSON aksi itinerari:", e);
        return { cleanContent, actionData: null };
      }
    }

    return { cleanContent: content, actionData: null };
  };

  const handleExecuteItineraryAction = (actionData: any) => {
    if (!onSaveItinerary) return;
    if (!currentUser || currentUser.id === "guest_empty") {
      alert("Silakan login terlebih dahulu untuk menyimpan rencana perjalanan.");
      return;
    }

    try {
      const targetItinerary: Itinerary = {
        id: actionData.id || "iti_" + Date.now(),
        title: actionData.title || "Itinerari Kustom AI",
        description: actionData.description || "Rencana perjalanan yang disusun otomatis oleh Asisten AI Pacitan.",
        days: (actionData.days || []).map((day: any) => ({
          dayNumber: Number(day.dayNumber) || 1,
          items: (day.items || []).map((item: any) => ({
            locationId: item.locationId || "",
            timeSlot: item.timeSlot || "08:00 - 10:00 WIB",
            note: item.note || "",
          })),
        })),
        isPublic: true,
        createdBy: currentUser.id,
        createdByName: currentUser.name,
        createdAt: actionData.action === "edit" ? (itineraries?.find(i => i.id === actionData.id)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      onSaveItinerary(targetItinerary);

      // Trigger a success toast
      window.dispatchEvent(new CustomEvent("show-toast", {
        detail: {
          message: actionData.action === "create" 
            ? `Itinerari "${targetItinerary.title}" berhasil dibuat!` 
            : `Perubahan itinerari "${targetItinerary.title}" berhasil diterapkan!`,
          type: "success"
        }
      }));

      // Navigate to /itinerary page
      window.location.hash = "/itinerary";
    } catch (e: any) {
      console.error("Gagal menjalankan aksi itinerari:", e);
      alert(`Gagal menerapkan aksi: ${e.message}`);
    }
  };

  // Formatting helper to replace raw asterisks and automatically render bold text and bullet points beautifully
  const formatMessageContent = (content: string) => {
    const lines = content.split("\n");
    return lines.map((line, idx) => {
      let isBullet = false;
      let cleanLine = line;

      // Match bullets: starts with optional space followed by * or - or + and space
      const bulletRegex = /^(\s*)[*+-]\s+/;
      if (bulletRegex.test(line)) {
        isBullet = true;
        cleanLine = line.replace(bulletRegex, "");
      }

      // Convert double asterisks **bold** to actual JSX <strong> elements
      const parts = [];
      let lastIndex = 0;
      const boldRegex = /\*\*([^*]+)\*\*/g;
      let match;

      while ((match = boldRegex.exec(cleanLine)) !== null) {
        const matchIndex = match.index;
        if (matchIndex > lastIndex) {
          parts.push(cleanLine.substring(lastIndex, matchIndex));
        }
        parts.push(
          <strong key={matchIndex} className="font-bold text-slate-900 dark:text-white">
            {match[1]}
          </strong>
        );
        lastIndex = boldRegex.lastIndex;
      }

      if (lastIndex < cleanLine.length) {
        parts.push(cleanLine.substring(lastIndex));
      }

      if (isBullet) {
        return (
          <div key={idx} className="flex items-start gap-2 ml-2.5 my-1">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 dark:bg-teal-400 shrink-0 mt-1.5" />
            <span className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">{parts}</span>
          </div>
        );
      }

      if (line.trim() === "") {
        return <div key={idx} className="h-2" />;
      }

      return (
        <p key={idx} className="text-xs leading-relaxed my-0.5 text-slate-700 dark:text-slate-300">
          {parts}
        </p>
      );
    });
  };

  // Load config & history on mount and when currentUser changes (per-user sessions)
  useEffect(() => {
    const loadedConfig = AiService.getConfig();
    setConfig(loadedConfig);
    setMessages(AiService.getChatHistory(currentUser?.id));

    const handleConfigUpdate = (e: CustomEvent<AiConfig>) => {
      setConfig(e.detail);
    };

    window.addEventListener("sipp_ai_config_updated" as any, handleConfigUpdate);
    return () => {
      window.removeEventListener("sipp_ai_config_updated" as any, handleConfigUpdate);
    };
  }, [currentUser?.id]);

  // Auto-scroll on new message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isSending]);

  // If AI is disabled OR not validated yet by Admin Utama:
  // Chatbot widget MUST NOT appear at all for anyone until enabled & validated.
  if (!config.enabled || !config.isValidated) {
    return null;
  }

  const handleFabClick = () => {
    if (!config.isValidated) {
      if (isAdminUtama) {
        setShowConfigModal(true);
      }
    } else {
      setIsOpen(!isOpen);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const prompt = (textToSend || inputText).trim();
    if (!prompt || isSending) return;

    if (!config.isValidated || !config.baseUrl || !config.modelName) {
      setShowConfigModal(true);
      return;
    }

    const userMessage: ChatMessage = {
      id: "usr_" + Date.now(),
      role: "user",
      content: prompt,
      timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    AiService.saveChatHistory(newMessages, currentUser?.id);
    setInputText("");
    setIsSending(true);
    setErrorMessage(null);

    try {
      const assistantReply = await AiService.sendMessage(prompt, messages, config, currentUser, locations, itineraries);
      const assistantMessage: ChatMessage = {
        id: "ai_" + Date.now(),
        role: "assistant",
        content: assistantReply,
        timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      };

      const updatedHistory = [...newMessages, assistantMessage];
      setMessages(updatedHistory);
      AiService.saveChatHistory(updatedHistory, currentUser?.id);
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal mendapatkan respon AI.");
    } finally {
      setIsSending(false);
    }
  };

  const handleClearHistory = () => {
    if (window.confirm("Hapus seluruh riwayat obrolan AI?")) {
      AiService.clearChatHistory(currentUser?.id);
      setMessages([]);
    }
  };

  return (
    <>
      {/* Floating Action Button (FAB) at Bottom Right */}
      <div className="fixed bottom-20 right-5 z-[2500]">
        <button
          id="sipp-ai-widget-button"
          onClick={handleFabClick}
          className={`group flex items-center gap-3 p-2.5 sm:pl-3 sm:pr-4 sm:py-2.5 rounded-full shadow-xl transition-all duration-300 cursor-pointer border ${
            config.isValidated
              ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-teal-250 dark:border-teal-900/60 hover:bg-teal-50/30 dark:hover:bg-teal-950/20 hover:border-teal-300 dark:hover:border-teal-800 hover:scale-105 active:scale-95 shadow-lg shadow-teal-500/5 hover:shadow-xl hover:shadow-teal-500/10"
              : "bg-slate-950 dark:bg-slate-900 text-white border-amber-500/80 hover:bg-slate-900 hover:border-amber-400 hover:scale-105 active:scale-95"
          }`}
          title={config.isValidated ? "Buka Asisten AI Pariwisata Pacitan" : "Konfigurasi Kunci AI LLM"}
        >
          <div className="relative">
            {config.isValidated ? (
              <div className="w-8.5 h-8.5 rounded-full bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400 flex items-center justify-center font-black transition-transform group-hover:rotate-12 duration-300">
                <Bot size={18} className="stroke-[2.5]" />
              </div>
            ) : (
              <div className="w-8.5 h-8.5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                <Key size={16} />
              </div>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.isValidated ? "bg-emerald-400" : "bg-amber-400"}`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${config.isValidated ? "bg-emerald-500" : "bg-amber-500"}`}></span>
            </span>
          </div>

          <div className="hidden sm:block text-left pr-1 select-none">
            <span className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
              {config.isValidated ? "Tanya Asisten AI" : "Setup Kunci AI"}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
              {config.isValidated ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>AI Siap Membantu</span>
                </>
              ) : (
                "Klik untuk Aktifkan"
              )}
            </span>
          </div>
        </button>
      </div>

      {/* Interactive Chatbot Popup Drawer/Modal */}
      {isOpen && config.isValidated && (
        <div className="fixed bottom-36 right-4 sm:right-6 z-[2600] w-[calc(100vw-2rem)] max-w-sm sm:max-w-md h-[540px] max-h-[80vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-slate-800 dark:text-slate-100">
          {/* Header */}
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-slate-950 shadow-md">
                <Bot size={20} className="stroke-[2.5]" />
              </div>
              <div>
                <h4 className="font-display font-bold text-sm leading-tight flex items-center gap-1.5">
                  Asisten AI Pacitan
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                </h4>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                  Asisten Pariwisata Cerdas Pacitan
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {isAdminUtama && (
                <button
                  onClick={() => setShowConfigModal(true)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
                  title="Pengaturan API Key / Model (Admin Utama)"
                >
                  <Settings size={17} />
                </button>
              )}
              {messages.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition cursor-pointer"
                  title="Hapus Obrolan"
                >
                  <Trash2 size={17} />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
                title="Minimize / Tutup"
              >
                <Minimize2 size={17} />
              </button>
            </div>
          </div>

          {/* Chat Messages Body */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50/50 dark:bg-slate-950/40 text-xs">
            {messages.length === 0 ? (
              <div className="py-6 px-2 text-center space-y-4">
                <div className="w-12 h-12 rounded-3xl bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto shadow-xs">
                  <Sparkles size={24} />
                </div>
                <div>
                  <h5 className="font-bold text-sm text-slate-800 dark:text-white">
                    Halo! Ada yang bisa saya bantu?
                  </h5>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                    Saya Asisten AI Pariwisata Pacitan. Tanyakan pantai, goa, rute jalan, atau rekomendasi kuliner lokal.
                  </p>
                </div>

                {/* Suggested Prompt Chips */}
                <div className="space-y-2 pt-2 text-left">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Contoh Pertanyaan:
                  </p>
                  {SUGGESTED_PROMPTS.map((item, idx) => {
                    const IconComp = item.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(item.text)}
                        className="w-full p-2.5 bg-white dark:bg-slate-800/80 hover:bg-teal-50 dark:hover:bg-teal-950/40 border border-slate-200 dark:border-slate-700 hover:border-teal-300 rounded-2xl text-left transition cursor-pointer flex items-center gap-2.5 text-slate-700 dark:text-slate-300 text-xs shadow-2xs"
                      >
                        <IconComp size={15} className="text-teal-600 dark:text-teal-400 shrink-0" />
                        <span>{item.text}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                      <Bot size={15} />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] p-3.5 rounded-2xl leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-teal-600 text-white font-medium rounded-br-xs shadow-xs"
                        : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700/80 rounded-bl-xs shadow-2xs"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <p className="text-xs leading-relaxed">{msg.content}</p>
                    ) : (
                      (() => {
                        const { cleanContent, actionData } = parseItineraryAction(msg.content);
                        return (
                          <div className="space-y-1">
                            <div>{formatMessageContent(cleanContent)}</div>
                            {actionData && (
                              <div className="mt-3 p-3 bg-teal-50 dark:bg-slate-800/90 border border-teal-200 dark:border-teal-950/60 rounded-xl text-slate-800 dark:text-slate-100 shadow-sm">
                                <div className="flex items-center gap-2 mb-2 text-teal-700 dark:text-teal-400 font-bold">
                                  <Compass className="w-4 h-4 animate-spin-slow text-teal-600 dark:text-teal-400 shrink-0" />
                                  <span className="text-[10px] font-black uppercase tracking-wider">
                                    Usulan Rencana Perjalanan AI
                                  </span>
                                </div>
                                <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                                  {actionData.title}
                                </h4>
                                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                                  {actionData.description}
                                </p>
                                
                                <div className="mt-2 flex items-center gap-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                  <span className="bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 px-1.5 py-0.5 rounded">
                                    {actionData.days?.length || 0} Hari
                                  </span>
                                  <span>•</span>
                                  <span>
                                    {actionData.days?.reduce((acc: number, d: any) => acc + (d.items?.length || 0), 0) || 0} Lokasi Wisata
                                  </span>
                                </div>

                                {(!currentUser || currentUser.id === "guest_empty") ? (
                                  <div className="mt-3 text-[10px] text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 p-2 rounded-lg border border-amber-200 dark:border-amber-900/60 leading-normal">
                                    Silakan login terlebih dahulu untuk menyimpan rencana perjalanan ini secara permanen di akun Anda.
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleExecuteItineraryAction(actionData)}
                                    className="mt-3 w-full py-1.5 px-3 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-xs cursor-pointer hover:shadow-sm"
                                  >
                                    <Sparkles size={14} className="stroke-[2.5]" />
                                    {actionData.action === "edit" ? "Terapkan Perubahan Itinerari" : "Simpan ke Itinerari Saya"}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()
                    )}
                    <span
                      className={`block text-[9px] mt-1.5 text-right font-mono ${
                        msg.role === "user" ? "text-teal-100" : "text-slate-400"
                      }`}
                    >
                      {msg.timestamp}
                    </span>
                  </div>

                  {msg.role === "user" && (
                    <div className="w-7 h-7 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                      <UserIcon size={15} />
                    </div>
                  )}
                </div>
              ))
            )}

            {isSending && (
              <div className="flex gap-2.5 justify-start items-center">
                <div className="w-7 h-7 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Bot size={15} />
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-2xl flex items-center gap-2 text-slate-500 dark:text-slate-400">
                  <RefreshCw size={14} className="animate-spin text-teal-500" />
                  <span className="text-xs italic">Asisten AI sedang mengetik...</span>
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-2xl text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2">
                <AlertCircle size={16} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Gagal Respon:</p>
                  <p className="text-[11px] mt-0.5">{errorMessage}</p>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Tanyakan seputar pariwisata Pacitan..."
                disabled={isSending}
                className="flex-1 px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 dark:text-white placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isSending}
                className="p-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-2xl transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-md shrink-0"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Ai Config Modal */}
      <AiConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        onConfigSaved={(updatedConfig) => {
          setConfig(updatedConfig);
          if (updatedConfig.isValidated) {
            setIsOpen(true);
          }
        }}
      />
    </>
  );
};
