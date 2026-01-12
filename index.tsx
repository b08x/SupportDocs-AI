
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI } from '@google/genai';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';

import { Artifact, Session, ComponentVariation, AIAdapter, GenerateParams, FileAttachment } from './types';
import { 
    INITIAL_PLACEHOLDERS, 
    KB_SOP_SYSTEM_INSTRUCTION, 
    KB_TROUBLESHOOTING_SYSTEM_INSTRUCTION, 
    KB_HOW_TO_SYSTEM_INSTRUCTION, 
    KB_ANECDOTE_SYSTEM_INSTRUCTION,
    KB_CHECKLIST_SYSTEM_INSTRUCTION,
    KB_INCIDENT_SYSTEM_INSTRUCTION
} from './constants';
import { generateId } from './utils';
import { exportToDocx } from './utils/docExport';

import DottedGlowBackground from './components/DottedGlowBackground';
import ArtifactCard from './components/ArtifactCard';
import SideDrawer from './components/SideDrawer';
import { 
    ThinkingIcon, 
    CodeIcon, 
    SparklesIcon, 
    ArrowLeftIcon, 
    ArrowRightIcon, 
    ArrowUpIcon, 
    GridIcon,
    PdfIcon,
    MarkdownIcon,
    FileTextIcon
} from './components/Icons';

type AIProvider = 'gemini' | 'mistral' | 'openrouter' | 'huggingface';

const WordIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <path d="M9 12h1"></path>
        <path d="M11 12h1"></path>
        <path d="M13 12h1"></path>
        <path d="M9 15h1"></path>
        <path d="M11 15h1"></path>
        <path d="M13 15h1"></path>
    </svg>
);

const HtmlIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <path d="M10 13l-2 2 2 2"></path>
        <path d="M14 13l2 2-2 2"></path>
    </svg>
);

const PaperclipIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.51a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
);

const XIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
);

const ResetIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
);

const SettingsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
);

const PencilIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
    </svg>
);

const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
);

const ChevronDownIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
);

const cleanHtml = (raw: string): string => {
    let cleaned = raw.trim();
    if (cleaned.startsWith('```html')) cleaned = cleaned.substring(7).trimStart();
    else if (cleaned.startsWith('```')) cleaned = cleaned.substring(3).trimStart();
    if (cleaned.endsWith('```')) cleaned = cleaned.substring(0, cleaned.length - 3).trimEnd();
    return cleaned;
};

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

const adapters: Record<AIProvider, AIAdapter> = {
    gemini: {
        async fetchModels(_apiKey: string) {
            return [
                'gemini-3-flash-preview', 
                'gemini-3-pro-preview', 
                'gemini-flash-lite-latest',
                'gemini-2.5-flash-image',
                'gemini-3-pro-image-preview',
                'gemini-2.5-flash-native-audio-preview-12-2025',
                'gemini-2.5-flash-preview-tts',
                'veo-3.1-fast-generate-preview',
                'veo-3.1-generate-preview'
            ];
        },
        async generateStream(_, { model, contents, config, onChunk }) {
            let retries = 0;
            const maxRetries = 3;
            const attempt = async () => {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                try {
                    const responseStream = await ai.models.generateContentStream({ model, contents, config });
                    for await (const chunk of responseStream) {
                        if (chunk.text) onChunk(chunk.text);
                    }
                } catch (error: any) {
                    if (error?.message?.includes('429') || error?.status === 'RESOURCE_EXHAUSTED') {
                        if (retries < maxRetries) {
                            retries++;
                            const backoff = Math.pow(2, retries) * 1000 + Math.random() * 1000;
                            await wait(backoff);
                            return attempt();
                        }
                    }
                    throw error;
                }
            };
            return attempt();
        }
    },
    mistral: {
        async fetchModels(apiKey) {
            const res = await fetch('https://api.mistral.ai/v1/models', { headers: { 'Authorization': `Bearer ${apiKey}` } });
            if (!res.ok) throw new Error('Failed to fetch from Mistral');
            const data = await res.json();
            return data.data.filter((m: any) => m.id.includes('mistral')).map((m: any) => m.id);
        },
        async generateStream(apiKey, { model, contents, onChunk }) {
            const messages = contents.map(c => ({ role: c.role === 'user' ? 'user' : 'assistant', content: typeof c.parts === 'string' ? c.parts : c.parts.map((p: any) => p.text || '').join('\n') }));
            const res = await fetch('https://api.mistral.ai/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }, body: JSON.stringify({ model, messages, stream: true }) });
            const reader = res.body?.getReader();
            const decoder = new TextDecoder();
            while (reader) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
                for (const line of lines) {
                    if (line === 'data: [DONE]') break;
                    try {
                        const json = JSON.parse(line.substring(6));
                        const text = json.choices[0]?.delta?.content;
                        if (text) onChunk(text);
                    } catch(e) {}
                }
            }
        }
    },
    openrouter: {
        async fetchModels(apiKey) {
            const res = await fetch('https://openrouter.ai/api/v1/models', { headers: { 'Authorization': `Bearer ${apiKey}` } });
            if (!res.ok) throw new Error('Failed to fetch from OpenRouter');
            const data = await res.json();
            return data.data.slice(0, 30).map((m: any) => m.id);
        },
        async generateStream(apiKey, { model, contents, onChunk }) {
            const messages = contents.map(c => ({ role: c.role === 'user' ? 'user' : 'assistant', content: typeof c.parts === 'string' ? c.parts : c.parts.map((p: any) => p.text || '').join('\n') }));
            const res = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }, body: JSON.stringify({ model, messages, stream: true }) });
            const reader = res.body?.getReader();
            const decoder = new TextDecoder();
            while (reader) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
                for (const line of lines) {
                    if (line === 'data: [DONE]') break;
                    try {
                        const json = JSON.parse(line.substring(6));
                        const text = json.choices[0]?.delta?.content;
                        if (text) onChunk(text);
                    } catch(e) {}
                }
            }
        }
    },
    huggingface: {
        async fetchModels(_apiKey: string) {
            return ['mistralai/Mistral-7B-Instruct-v0.2', 'meta-llama/Llama-2-7b-chat-hf', 'google/gemma-7b-it'];
        },
        async generateStream(apiKey, { model, contents, onChunk }) {
            const prompt = contents.map(c => `${c.role === 'user' ? 'User' : 'Assistant'}: ${typeof c.parts === 'string' ? c.parts : c.parts.map((p: any) => p.text || '').join('\n')}`).join('\n') + '\nAssistant:';
            const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }, body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 1024 }, stream: true }) });
            const reader = res.body?.getReader();
            const decoder = new TextDecoder();
            while (reader) {
                const { done, value } = await reader.read();
                if (done) break;
                const text = decoder.decode(value);
                if (text) onChunk(text);
            }
        }
    }
};

function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionIndex, setCurrentSessionIndex] = useState<number>(-1);
  const [focusedArtifactIndex, setFocusedArtifactIndex] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [placeholders, setPlaceholders] = useState<string[]>(INITIAL_PLACEHOLDERS);
  const [isResetConfirming, setIsResetConfirming] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [activeProvider, setActiveProvider] = useState<AIProvider>('gemini');
  const [activeModel, setActiveModel] = useState<string>('gemini-3-flash-preview');
  const [apiKeys, setApiKeys] = useState<Record<AIProvider, string>>({
      gemini: process.env.API_KEY || '',
      mistral: '',
      openrouter: '',
      huggingface: ''
  });
  const [availableModels, setAvailableModels] = useState<string[]>(['gemini-3-flash-preview', 'gemini-3-pro-preview', 'gemini-flash-lite-latest']);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState<boolean>(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [variantFlavor, setVariantFlavor] = useState('Standard Audiences');
  const [drawerState, setDrawerState] = useState<{ isOpen: boolean; mode: 'code' | 'variants' | 'settings' | null; title: string; data: any; }>({ isOpen: false, mode: null, title: '', data: null });
  const [componentVariations, setComponentVariations] = useState<ComponentVariation[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
          if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
              setIsExportMenuOpen(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const updateModels = async () => {
        setSyncError(null);
        setSyncSuccess(false);
        if (activeProvider === 'gemini') {
            const models = await adapters.gemini.fetchModels(apiKeys.gemini);
            setAvailableModels(models);
            if (!models.includes(activeModel)) setActiveModel(models[0]);
        } else {
            setAvailableModels([]);
        }
    };
    updateModels();
  }, [activeProvider, apiKeys.gemini]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    const fileList = Array.from(files) as File[];
    for (const file of fileList) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result as string;
            const base64 = result.split(',')[1];
            setAttachments(prev => [...prev, { id: generateId(), file, name: file.name, base64, mimeType: file.type || 'application/octet-stream' }]);
        };
        reader.readAsDataURL(file);
    }
    event.target.value = '';
  };

  const removeAttachment = (id: string) => { setAttachments(prev => prev.filter(a => a.id !== id)); };

  const handleSyncModels = async () => {
      const key = apiKeys[activeProvider];
      if (activeProvider !== 'gemini' && !key) { setSyncError("Please enter an API key for this provider."); return; }
      setIsSyncing(true);
      setSyncError(null);
      setSyncSuccess(false);
      try {
          const models = await adapters[activeProvider].fetchModels(key);
          if (models && models.length > 0) {
              setAvailableModels(models);
              setActiveModel(models[0]);
              setSyncSuccess(true);
              setTimeout(() => setSyncSuccess(false), 3000);
          } else { setSyncError("No models found for this provider."); }
      } catch (e: any) { setSyncError(`Failed to fetch models: ${e.message}`); } finally { setIsSyncing(false); }
  };

  const handleReset = () => {
    setSessions([]);
    setCurrentSessionIndex(-1);
    setFocusedArtifactIndex(null);
    setAttachments([]);
    setInputValue('');
    setIsEditing(false);
    setIsResetConfirming(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleArtifactUpdate = (newHtml: string) => {
    if (currentSessionIndex === -1 || focusedArtifactIndex === null) return;
    setSessions(prev => prev.map((session, sIdx) => 
        sIdx === currentSessionIndex ? {
            ...session,
            artifacts: session.artifacts.map((art, aIdx) => 
                aIdx === focusedArtifactIndex ? { ...art, html: newHtml } : art
            )
        } : session
    ));
  };

  const handleGenerateVariations = useCallback(async () => {
    const currentSession = sessions[currentSessionIndex];
    if (!currentSession || focusedArtifactIndex === null) return;
    const currentArtifact = currentSession.artifacts[focusedArtifactIndex];
    setIsLoading(true);
    setComponentVariations([]);
    setDrawerState({ isOpen: true, mode: 'variants', title: 'Document Variants', data: currentArtifact.id });
    try {
        const apiKey = apiKeys[activeProvider];
        const flavorPrompt = variantFlavor === 'Standard Audiences' ? 'Executive, Technical, Narrative' : variantFlavor === 'Regional detours' ? 'London Office, Tokyo Data Center, remote field worker' : 'Legal Compliance, High-Security, End-User Friendly';
        const prompt = `Generate 3 variations for different audiences (${flavorPrompt}). Original Topic: "${currentSession.prompt}". Return the response as a JSON array of objects: [{"name": "Variant Name", "html": "...html content..."}]`;
        let accumulated = '';
        await adapters[activeProvider].generateStream(apiKey, {
            model: activeModel,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            onChunk: (chunk) => {
                accumulated += chunk;
                const cleaned = cleanHtml(accumulated);
                try {
                    const parsed = JSON.parse(cleaned);
                    if (Array.isArray(parsed)) { setComponentVariations(parsed); }
                } catch(e) {}
            }
        });
    } catch (e: any) { 
        console.error("Error generating variants:", e); 
        setDrawerState(prev => ({ ...prev, data: `Error: ${e.message}` }));
    } finally { setIsLoading(false); }
  }, [sessions, currentSessionIndex, focusedArtifactIndex, activeProvider, activeModel, apiKeys, variantFlavor]);

  const applyVariation = (html: string) => {
      if (focusedArtifactIndex === null) return;
      handleArtifactUpdate(html);
      setDrawerState(s => ({ ...s, isOpen: false }));
  };

  const handleExport = (format: 'pdf' | 'md' | 'txt' | 'docx' | 'html') => {
    const currentSession = sessions[currentSessionIndex];
    if (!currentSession || focusedArtifactIndex === null) return;
    const artifact = currentSession.artifacts[focusedArtifactIndex];
    const fileName = `${artifact.styleName.replace(/\s+/g, '_')}_${Date.now()}`;
    if (format === 'pdf') {
        const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${artifact.styleName}</title><style>body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #111; line-height: 1.6; } ${artifact.html.match(/<style>([\s\S]*?)<\/style>/)?.[1] || ''}</style></head><body>${artifact.html.replace(/<style>[\s\S]*?<\/style>/, '')}<script>window.onload = () => setTimeout(() => { try { window.print(); } catch(e) {} }, 500);</script></body></html>`;
        const blob = new Blob([fullHtml], { type: 'text/html' });
        window.open(URL.createObjectURL(blob), '_blank');
    } else if (format === 'docx') {
        exportToDocx(artifact.html, artifact.styleName);
    } else if (format === 'html') {
        const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${artifact.styleName}</title><style>body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #111; line-height: 1.6; } ${artifact.html.match(/<style>([\s\S]*?)<\/style>/)?.[1] || ''}</style></head><body>${artifact.html.replace(/<style>[\s\S]*?<\/style>/, '')}</body></html>`;
        const blob = new Blob([fullHtml], { type: 'text/html' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${fileName}.html`;
        link.click();
    } else {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = artifact.html;
        tempDiv.querySelector('style')?.remove();
        const content = tempDiv.innerText || tempDiv.textContent || '';
        const blob = new Blob([content], { type: format === 'md' ? 'text/markdown' : 'text/plain' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${fileName}.${format === 'md' ? 'md' : 'txt'}`;
        link.click();
    }
    setIsExportMenuOpen(false);
  };

  const handleSendMessage = useCallback(async (manualPrompt?: string) => {
    const promptToUse = manualPrompt || inputValue;
    const trimmedInput = promptToUse.trim();
    if (!trimmedInput && attachments.length === 0) return;
    if (isLoading) return;
    if (!manualPrompt) setInputValue('');

    setIsLoading(true);
    const sessionId = generateId();
    const styles = ["Technical SOP", "Checklist", "Incident Log", "Troubleshooting Guide", "Brief Anecdote", "How-to Guide"];
    const placeholderArtifacts: Artifact[] = Array(styles.length).fill(null).map((_, i) => ({ id: `${sessionId}_${i}`, styleName: 'Drafting...', html: '', status: 'streaming' }));
    
    // Aggregating historical attachments to prevent context loss during refinement
    const historicalAttachments: FileAttachment[] = [];
    const seenAttachmentIds = new Set<string>();
    
    sessions.forEach(sess => {
        if (sess.attachments) {
            sess.attachments.forEach(att => {
                if (!seenAttachmentIds.has(att.id)) {
                    historicalAttachments.push(att);
                    seenAttachmentIds.add(att.id);
                }
            });
        }
    });
    
    // Adding current attachments
    const currentAttachments = [...attachments];
    currentAttachments.forEach(att => {
        if (!seenAttachmentIds.has(att.id)) {
            historicalAttachments.push(att);
            seenAttachmentIds.add(att.id);
        }
    });

    // Build history of session prompts to keep model in context
    const contextHistory: any[] = [];
    sessions.forEach(sess => {
        contextHistory.push({ role: 'user', parts: [{ text: sess.prompt }] });
        contextHistory.push({ role: 'model', parts: [{ text: "DOCUMENTS_GENERATED" }] });
    });

    const lastSession = sessions.length > 0 ? sessions[sessions.length - 1] : null;
    setAttachments([]);
    setSessions(prev => [...prev, { id: sessionId, prompt: trimmedInput || "Attached Documents Analysis", timestamp: Date.now(), artifacts: placeholderArtifacts, attachments: currentAttachments }]);
    setCurrentSessionIndex(sessions.length);
    setFocusedArtifactIndex(null);
    setIsEditing(false);

    const apiKey = apiKeys[activeProvider];
    try {
        setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, artifacts: s.artifacts.map((a, i) => ({ ...a, styleName: styles[i] })) } : s));

        await Promise.all(placeholderArtifacts.map(async (art, i) => {
            await wait(i * 300);
            const style = styles[i];
            let systemInstruction = "You are an expert technical writer.";
            if (style === "Technical SOP") systemInstruction = KB_SOP_SYSTEM_INSTRUCTION;
            else if (style === "Troubleshooting Guide") systemInstruction = KB_TROUBLESHOOTING_SYSTEM_INSTRUCTION;
            else if (style === "How-to Guide") systemInstruction = KB_HOW_TO_SYSTEM_INSTRUCTION;
            else if (style === "Brief Anecdote") systemInstruction = KB_ANECDOTE_SYSTEM_INSTRUCTION;
            else if (style === "Checklist") systemInstruction = KB_CHECKLIST_SYSTEM_INSTRUCTION;
            else if (style === "Incident Log") systemInstruction = KB_INCIDENT_SYSTEM_INSTRUCTION;

            const previousDoc = lastSession?.artifacts.find(pa => pa.styleName === style);
            let artPrompt = "";
            if (previousDoc && previousDoc.html) {
                artPrompt = `
                  [PREVIOUS VERSION OF THIS DOCUMENT]
                  ${previousDoc.html}

                  [REFINEMENT REQUEST]
                  The user wants to refine the documentation suite. Their specific update intent for this turn is: "${trimmedInput}".

                  [TASK]
                  Update the [PREVIOUS VERSION OF THIS DOCUMENT] using the [REFINEMENT REQUEST].
                  Maintain strict adherence to the SCRIBE persona and document styling. 
                  Output the FULL updated HTML document.
                `;
            } else {
                artPrompt = `
                  [CONTEXT]
                  The user wants to document: "${trimmedInput || "the attached documents"}".

                  [TASK]
                  Generate a highly professional ${style} documentation artifact.
                  Adhere strictly to the SCRIBE persona instructions.
                `;
            }
            
            const parts: any[] = [{ text: artPrompt }];
            // Carry forward ALL attachments as they represent the "Source of Truth" for the session thread
            for (const att of historicalAttachments) {
                parts.push({ inlineData: { data: att.base64, mimeType: att.mimeType } });
            }

            let accumulated = '';
            try {
                await adapters[activeProvider].generateStream(apiKey, {
                    model: activeModel,
                    contents: [...contextHistory, { role: 'user', parts }],
                    config: { systemInstruction },
                    onChunk: (chunk) => {
                        accumulated += chunk;
                        const processedHtml = cleanHtml(accumulated);
                        setSessions(prev => prev.map(sess => sess.id === sessionId ? { ...sess, artifacts: sess.artifacts.map(a => a.id === art.id ? { ...a, html: processedHtml } : a) } : sess));
                    }
                });
                setSessions(prev => prev.map(sess => sess.id === sessionId ? { ...sess, artifacts: sess.artifacts.map(a => a.id === art.id ? { ...a, status: 'complete', html: cleanHtml(accumulated) } : a) } : sess));
            } catch (e: any) {
                setSessions(prev => prev.map(sess => sess.id === sessionId ? { ...sess, artifacts: sess.artifacts.map(a => a.id === art.id ? { ...a, status: 'error', html: `<p style="color:red; padding: 20px; font-family: sans-serif;">Error: ${e.message}</p>` } : a) } : sess));
            }
        }));
    } catch (e) { console.error("Fatal error", e); } finally { setIsLoading(false); }
  }, [inputValue, isLoading, sessions, apiKeys, activeProvider, activeModel, attachments]);

  const hasStarted = sessions.length > 0 || isLoading;
  const currentSession = sessions[currentSessionIndex];

  return (
    <>
        <SideDrawer isOpen={drawerState.isOpen} onClose={() => setDrawerState(s => ({...s, isOpen: false}))} title={drawerState.title}>
            {drawerState.mode === 'settings' && (
                <div className="settings-panel">
                    <div className="settings-group">
                        <label>AI Provider</label>
                        <select value={activeProvider} onChange={(e) => setActiveProvider(e.target.value as AIProvider)}>
                            <option value="gemini">Google Gemini</option>
                            <option value="mistral">Mistral AI</option>
                            <option value="openrouter">OpenRouter</option>
                            <option value="huggingface">Hugging Face</option>
                        </select>
                    </div>
                    {activeProvider !== 'gemini' && (
                        <div className="settings-group">
                            <label>{activeProvider.toUpperCase()} API Key</label>
                            <div className="key-input-row">
                                <input type="password" placeholder="Enter API Key" value={apiKeys[activeProvider]} onChange={(e) => setApiKeys(prev => ({ ...prev, [activeProvider]: e.target.value }))} />
                                <button onClick={handleSyncModels} disabled={isSyncing}>{isSyncing ? 'Syncing...' : 'Sync Models'}</button>
                            </div>
                            {syncError && <p className="error-text">{syncError}</p>}
                            {syncSuccess && <p className="success-text">Models synced successfully!</p>}
                        </div>
                    )}
                    <div className="settings-group">
                        <label>Preferred Model</label>
                        <select value={activeModel} onChange={(e) => setActiveModel(e.target.value)}>
                            {availableModels.length > 0 ? (
                                availableModels.map(m => <option key={m} value={m}>{m}</option>)
                            ) : (
                                <option disabled>Sync to see models</option>
                            )}
                        </select>
                    </div>
                </div>
            )}
            {drawerState.mode === 'variants' && (
                <div className="sexy-grid">
                    <div className="flavor-selection">
                        <label>Flavor Detour</label>
                        <select value={variantFlavor} onChange={(e) => setVariantFlavor(e.target.value)}>
                            <option value="Standard Audiences">Standard Audiences (Exec/Tech/User)</option>
                            <option value="Regional detours">Regional / Site Detours</option>
                            <option value="Compliance variants">Compliance / Security Focused</option>
                        </select>
                        <button className="regenerate-variants" onClick={handleGenerateVariations} disabled={isLoading}>
                             <SparklesIcon /> {isLoading ? 'Refining...' : 'Regenerate'}
                        </button>
                    </div>
                    <div className="variants-list">
                        {componentVariations.map((v, i) => (
                             <div key={i} className="sexy-card" onClick={() => applyVariation(v.html)}>
                                 <div className="sexy-preview"><iframe srcDoc={v.html} sandbox="allow-scripts allow-same-origin" /></div>
                                 <div className="sexy-label">{v.name}</div>
                             </div>
                        ))}
                    </div>
                    {isLoading && componentVariations.length === 0 && <div className="loading-variations">Refining versions...</div>}
                    {!isLoading && componentVariations.length === 0 && drawerState.data && (
                        <div className="error-text" style={{ padding: '20px', textAlign: 'center' }}>{drawerState.data}</div>
                    )}
                </div>
            )}
            {drawerState.mode === 'code' && <pre className="code-block"><code>{drawerState.data}</code></pre>}
        </SideDrawer>

        <div className="immersive-app">
            <DottedGlowBackground gap={24} radius={1.5} speedScale={0.5} />
            <div className="utility-bar">
                <button className="reset-session-btn" onClick={() => setDrawerState({ isOpen: true, mode: 'settings', title: 'AI Configuration', data: null })}><SettingsIcon /> Settings</button>
                {sessions.length > 0 && (
                    <div className="reset-container">
                        {!isResetConfirming ? (
                            <button className="reset-session-btn" onClick={() => setIsResetConfirming(true)}><ResetIcon /> Reset</button>
                        ) : (
                            <div className="confirm-group">
                                <button className="reset-session-btn confirm" onClick={handleReset}>Reset Now?</button>
                                <button className="reset-session-btn cancel" onClick={() => setIsResetConfirming(false)}>Back</button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className={`stage-container ${focusedArtifactIndex !== null ? 'mode-focus' : 'mode-split'}`}>
                 <div className={`empty-state ${hasStarted ? 'fade-out' : ''}`}>
                     <div className="empty-content">
                         <h1>SupportDocs AI</h1>
                         <p>Instant IT knowledge base generation for engineering teams</p>
                         <button className="surprise-button" onClick={() => handleSendMessage(placeholders[placeholderIndex])}><SparklesIcon /> Random Topic</button>
                     </div>
                 </div>
                {sessions.map((session, sIndex) => (
                    <div key={session.id} className={`session-group ${sIndex === currentSessionIndex ? 'active-session' : 'past-session'}`}>
                        <div className="artifact-grid">
                            {session.artifacts.map((artifact, aIndex) => (
                                <ArtifactCard 
                                    key={artifact.id} artifact={artifact} 
                                    isFocused={focusedArtifactIndex === aIndex} 
                                    isEditing={focusedArtifactIndex === aIndex && isEditing}
                                    onUpdate={handleArtifactUpdate}
                                    onClick={() => setFocusedArtifactIndex(aIndex)} 
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className={`action-bar ${focusedArtifactIndex !== null ? 'visible' : ''}`}>
                 <div className="active-prompt-label">{currentSession?.prompt}</div>
                 <div className="action-buttons-wrapper">
                    <div className="action-buttons">
                        <div className="btn-group">
                            <button onClick={() => { setFocusedArtifactIndex(null); setIsEditing(false); }}><GridIcon /> View All</button>
                        </div>
                        <div className="btn-group main-actions">
                            <button onClick={() => setIsEditing(!isEditing)} className={isEditing ? 'active' : ''}>
                                {isEditing ? <><CheckIcon /> Done</> : <><PencilIcon /> Edit</>}
                            </button>
                            {!isEditing && (
                                <button onClick={handleGenerateVariations} disabled={isLoading}>
                                    <SparklesIcon /> Variants
                                </button>
                            )}
                            <button onClick={() => setDrawerState({ isOpen: true, mode: 'code', title: 'Source', data: currentSession?.artifacts[focusedArtifactIndex || 0].html })}><CodeIcon /> Source</button>
                        </div>
                        
                        {!isEditing && (
                            <div className="export-dropdown-container" ref={exportRef}>
                                <button className={`export-trigger ${isExportMenuOpen ? 'active' : ''}`} onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}>
                                    Export <ChevronDownIcon />
                                </button>
                                {isExportMenuOpen && (
                                    <div className="export-menu">
                                        <button onClick={() => handleExport('docx')}><WordIcon /> Word</button>
                                        <button onClick={() => handleExport('pdf')}><PdfIcon /> PDF</button>
                                        <button onClick={() => handleExport('html')}><HtmlIcon /> HTML</button>
                                        <button onClick={() => handleExport('md')}><MarkdownIcon /> MD</button>
                                        <button onClick={() => handleExport('txt')}><FileTextIcon /> TXT</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                 </div>
            </div>

            <div className="floating-input-container">
                <div className="input-outer-wrapper">
                    {attachments.length > 0 && (
                        <div className="attachment-pills">
                            {attachments.map(att => (
                                <div key={att.id} className="attachment-pill">
                                    <span className="file-name">{att.name}</span>
                                    <button onClick={() => removeAttachment(att.id)} className="remove-att"><XIcon /></button>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className={`input-wrapper ${isLoading ? 'loading' : ''}`}>
                        <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} multiple accept=".pdf,image/*,.txt,.md,.log" />
                        <button className="attachment-trigger" onClick={() => fileInputRef.current?.click()} disabled={isLoading}><PaperclipIcon /></button>
                        <div className="input-main">
                            <input ref={inputRef} type="text" placeholder={sessions.length > 0 ? "Refine these documents..." : "What do we need to document?"} value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} disabled={isLoading} />
                        </div>
                        <button className="send-button" onClick={() => handleSendMessage()} disabled={isLoading || (!inputValue.trim() && attachments.length === 0)}><ArrowUpIcon /></button>
                    </div>
                </div>
            </div>
        </div>
    </>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<React.StrictMode><App /></React.StrictMode>);
}
