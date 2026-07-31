import React, { useState, useEffect } from "react";
import { AiConfig, AiProviderPreset } from "../types";
import { AiService, PROVIDER_PRESETS, DEFAULT_AI_CONFIG } from "../lib/aiService";
import {
  Sparkles,
  Key,
  Globe,
  Cpu,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  ExternalLink,
  ShieldCheck,
  Zap,
  Bot,
  Power
} from "lucide-react";

interface AiConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: (config: AiConfig) => void;
}

export const AiConfigModal: React.FC<AiConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
}) => {
  const [config, setConfig] = useState<AiConfig>(DEFAULT_AI_CONFIG);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    sampleReply?: string;
  } | null>(null);

  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchModelsError, setFetchModelsError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const current = AiService.getConfig();
      setConfig(current);
      setTestResult(null);
      setFetchedModels([]);
      setFetchModelsError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectPreset = (presetKey: AiProviderPreset) => {
    const preset = PROVIDER_PRESETS[presetKey];
    setConfig((prev) => ({
      ...prev,
      provider: presetKey,
      baseUrl: preset.baseUrl,
      modelName: preset.defaultModel || prev.modelName,
      isValidated: false, // Reset validation when preset changes
    }));
    setTestResult(null);
    setFetchedModels([]);
    setFetchModelsError(null);
  };

  const handleFetchModels = async () => {
    if (!config.baseUrl) {
      setFetchModelsError("Base URL tidak boleh kosong.");
      return;
    }
    setFetchingModels(true);
    setFetchModelsError(null);
    try {
      const models = await AiService.fetchAvailableModels(config);
      setFetchedModels(models);
    } catch (err: any) {
      setFetchModelsError(err.message || "Gagal mengambil daftar model.");
      setFetchedModels([]);
    } finally {
      setFetchingModels(false);
    }
  };

  const handleTestAndSave = async () => {
    setTesting(true);
    setTestResult(null);

    const result = await AiService.testConnection(config);
    setTesting(false);
    setTestResult(result);

    const updatedConfig: AiConfig = {
      ...config,
      isValidated: result.success,
      lastTestedAt: new Date().toISOString(),
      validationMessage: result.message,
    };

    setConfig(updatedConfig);
    AiService.saveConfig(updatedConfig);

    if (onConfigSaved) {
      onConfigSaved(updatedConfig);
    }
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-800 dark:text-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-slate-950 shadow-md">
              <Bot size={22} className="stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-display font-extrabold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                Pengaturan API Key LLM / AI
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gunakan OpenRouter, Groq, OpenAI, Google Gemini, atau Endpoint Kustom
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* AI Feature Master ON/OFF Switch */}
          <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 flex items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 transition-colors ${
                config.enabled ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" : "bg-rose-500/20 text-rose-400 border border-rose-500/40"
              }`}>
                <Power size={20} />
              </div>
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-white flex items-center gap-2">
                  Status Asisten AI (Chatbot Widget)
                  <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-full uppercase ${
                    config.enabled ? "bg-emerald-500/30 text-emerald-300 border border-emerald-500/50" : "bg-rose-500/30 text-rose-300 border border-rose-500/50"
                  }`}>
                    {config.enabled ? "AKTIF (ON)" : "NONAKTIF (OFF)"}
                  </span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {config.enabled
                    ? "Popup Asisten AI muncul di pojok kanan bawah untuk seluruh pengunjung."
                    : "Popup Asisten AI disembunyikan sepenuhnya dari publik & pengunjung."}
                </p>
              </div>
            </div>

            {/* Toggle Button */}
            <button
              type="button"
              onClick={() => {
                const updated = { ...config, enabled: !config.enabled };
                setConfig(updated);
                AiService.saveConfig(updated);
                if (onConfigSaved) onConfigSaved(updated);
              }}
              className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                config.enabled ? "bg-emerald-500" : "bg-slate-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  config.enabled ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Provider Preset Buttons */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Pilih Penyedia AI (Provider Preset)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(PROVIDER_PRESETS) as AiProviderPreset[]).map((key) => {
                const isSelected = config.provider === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSelectPreset(key)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? "bg-teal-50 dark:bg-teal-950/40 border-teal-500 text-teal-900 dark:text-teal-200 font-bold shadow-xs"
                        : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <span className="text-xs font-bold flex items-center justify-between">
                      {PROVIDER_PRESETS[key].name}
                      {isSelected && <Zap size={13} className="text-teal-600 dark:text-teal-400 fill-teal-500" />}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate mt-1">
                      {key === "openrouter" ? "OpenRouter AI" : key === "groq" ? "Groq Cloud" : key === "gemini_openai" ? "Google AI" : key}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 bg-slate-100 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
              💡 <span className="font-semibold text-slate-700 dark:text-slate-300">{PROVIDER_PRESETS[config.provider].name}:</span>{" "}
              {PROVIDER_PRESETS[config.provider].note}
            </p>
          </div>

          {/* Form Fields */}
          <div className="space-y-3.5">
            {/* Base URL */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Globe size={14} className="text-teal-500" />
                Base URL Endpoint API
              </label>
              <input
                type="text"
                value={config.baseUrl}
                onChange={(e) => setConfig({ ...config, baseUrl: e.target.value, isValidated: false })}
                placeholder="https://openrouter.ai/api/v1 atau https://api.openai.com/v1"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Sistem akan memanggil endpoint <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded">{config.baseUrl || "..."}/chat/completions</code>.
              </p>
            </div>

            {/* API Key */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Key size={14} className="text-teal-500" />
                  API Key
                </span>
                {config.provider === "openrouter" && (
                  <a
                    href="https://openrouter.ai/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 font-semibold"
                  >
                    Dapatkan Kunci OpenRouter <ExternalLink size={11} />
                  </a>
                )}
                {config.provider === "groq" && (
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 font-semibold"
                  >
                    Dapatkan Kunci Groq <ExternalLink size={11} />
                  </a>
                )}
              </label>
              <input
                type="password"
                value={config.apiKey}
                onChange={(e) => setConfig({ ...config, apiKey: e.target.value, isValidated: false })}
                placeholder={config.provider === "ollama" ? "Opsional untuk Ollama / Local" : "sk-or-v1-xxxxxxxx..."}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
              />
            </div>

            {/* Model Name */}
            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Cpu size={14} className="text-teal-500" />
                  Konfigurasi Model AI
                </span>
                <span className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold bg-teal-50 dark:bg-slate-800 px-1.5 py-0.5 rounded-md border border-teal-100 dark:border-slate-700">
                  Presisi & Fleksibel
                </span>
              </label>

              {/* Dynamic Auto-fetching section */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-150 dark:border-slate-800/60 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                    <Sparkles size={12} className="text-teal-500" />
                    Daftar Model Otomatis dari API
                  </span>
                  <button
                    type="button"
                    disabled={fetchingModels}
                    onClick={handleFetchModels}
                    className="text-[10px] font-bold bg-teal-500 hover:bg-teal-600 active:scale-[0.98] text-slate-950 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    <RefreshCw size={11} className={fetchingModels ? "animate-spin" : ""} />
                    {fetchingModels ? "Mengambil..." : "Muat Model dari Server"}
                  </button>
                </div>

                {fetchModelsError && (
                  <div className="text-[10px] text-rose-600 dark:text-rose-400 font-medium bg-rose-50 dark:bg-rose-950/20 p-2.5 rounded-xl border border-rose-200/50 dark:border-rose-900/50 flex items-start gap-1.5 leading-normal">
                    <AlertCircle size={12} className="shrink-0 mt-0.5" />
                    <span>{fetchModelsError}</span>
                  </div>
                )}

                {fetchedModels.length > 0 ? (
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-slate-400 block">
                      Pilih dari Dropdown:
                    </span>
                    <select
                      value={fetchedModels.includes(config.modelName) ? config.modelName : ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                          setConfig((prev) => ({ ...prev, modelName: val, isValidated: false }));
                        }
                      }}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
                    >
                      <option value="">-- Pilih Model yang Tersedia ({fetchedModels.length}) --</option>
                      {fetchedModels.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-400 italic">
                    Belum ada model dimuat. Klik tombol di atas untuk menarik daftar model yang tersedia berdasarkan Base URL dan API Key Anda saat ini.
                  </div>
                )}
              </div>

              {/* Manual Input Field */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-450 block">
                  Nama Model Terpilih (Tulis Manual jika tidak ada di daftar):
                </span>
                <input
                  type="text"
                  value={config.modelName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setConfig((prev) => ({
                      ...prev,
                      modelName: val,
                      isValidated: false,
                    }));
                  }}
                  placeholder="Contoh: google/gemini-2.5-flash, gpt-4o-mini, dll."
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal-500 dark:text-white"
                />
              </div>

              {/* Model Chips Suggestion */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Rekomendasi Cepat ({PROVIDER_PRESETS[config.provider].name}):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(config.provider === "openrouter"
                    ? ["google/gemini-2.5-flash", "groq/compound-mini", "openai/gpt-4o-mini", "deepseek/deepseek-r1"]
                    : config.provider === "groq"
                    ? ["llama-3.1-8b-instant", "llama-3.3-70b-versatile", "mixtral-8x7b-32768", "gemma2-9b-it"]
                    : config.provider === "gemini_openai"
                    ? ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-pro"]
                    : config.provider === "openai"
                    ? ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"]
                    : ["llama-3.1-8b-instant", "google/gemini-2.5-flash", "gpt-4o-mini"]
                  ).map((mName) => (
                    <button
                      key={mName}
                      type="button"
                      onClick={() => {
                        setConfig((prev) => ({
                          ...prev,
                          modelName: mName,
                          isValidated: false,
                        }));
                      }}
                      className={`text-[10px] font-mono px-2 py-1 rounded-lg border cursor-pointer transition ${
                        config.modelName === mName
                          ? "bg-teal-500 text-slate-950 font-bold border-teal-400 shadow-xs"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-teal-400"
                      }`}
                    >
                      {mName}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-[10px] text-slate-400 mt-2 leading-normal">
                {config.provider === "groq" ? (
                  <span>
                    ⚠️ <b>Groq Direct API:</b> Gunakan nama model Groq tanpa awalan <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">groq/</code> (contoh: <code className="text-teal-400">llama-3.1-8b-instant</code>). Jika ingin menggunakan <code className="text-teal-400">groq/compound-mini</code>, gunakan preset <b>OpenRouter</b>.
                  </span>
                ) : config.provider === "openrouter" ? (
                  <span>
                    💡 <b>OpenRouter API:</b> Gunakan format <code className="text-teal-400">penyedia/nama-model</code> (contoh: <code className="text-teal-400">groq/compound-mini</code>, <code className="text-teal-400">google/gemini-2.5-flash</code>, <code className="text-teal-400">openai/gpt-4o-mini</code>).
                  </span>
                ) : (
                  <span>
                    Masukkan nama model persis yang didukung oleh endpoint API Anda.
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Test Status Feedback Banner */}
          {testResult && (
            <div
              className={`p-4 rounded-2xl border text-xs leading-relaxed animate-in fade-in slide-in-from-top-2 duration-200 ${
                testResult.success
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                  : "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200"
              }`}
            >
              <div className="flex items-start gap-2.5">
                {testResult.success ? (
                  <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={18} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <h5 className="font-bold text-xs">{testResult.message}</h5>
                  {testResult.sampleReply && (
                    <p className="text-[11px] mt-1.5 italic bg-white/70 dark:bg-slate-900/60 p-2 rounded-xl border border-emerald-200/60 dark:border-emerald-900">
                      " {testResult.sampleReply} "
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {config.isValidated && !testResult && (
            <div className="p-3 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-2xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
              <span className="flex items-center gap-2 font-bold">
                <ShieldCheck size={16} className="text-emerald-600 dark:text-emerald-400" />
                Konfigurasi ini telah terverifikasi & aktif.
              </span>
              <span className="text-[10px] opacity-75 font-mono">
                {config.lastTestedAt ? new Date(config.lastTestedAt).toLocaleTimeString("id-ID") : ""}
              </span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-xl transition cursor-pointer"
          >
            Tutup
          </button>

          <button
            type="button"
            onClick={handleTestAndSave}
            disabled={testing || !config.baseUrl || !config.modelName}
            className="px-5 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testing ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                Menguji Koneksi API...
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Uji Validasi & Simpan Kunci AI
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
