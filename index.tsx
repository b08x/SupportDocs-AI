
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI } from '@google/genai';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';

import { Artifact, Session, Message, ComponentVariation, AIAdapter, GenerateParams, FileAttachment } from './types';
import { 
    INITIAL_PLACEHOLDERS, 
    KB_SOP_SYSTEM_INSTRUCTION, 
    KB_TROUBLESHOOTING_SYSTEM_INSTRUCTION, 
    KB_HOW_TO_SYSTEM_INSTRUCTION, 
    KB_ANECDOTE_SYSTEM_INSTRUCTION, 
    KB_CHECKLIST_SYSTEM_INSTRUCTION,
    KB_INCIDENT_SYSTEM_INSTRUCTION,
    KB_EDIT_SYSTEM_INSTRUCTION
} from './constants';
import { generateId } from './utils';
import { exportToDocx } from './utils/docExport';

import DottedGlowBackground from './components/DottedGlowBackground';
import ArtifactCard from './components/ArtifactCard';
import SideDrawer from './components/SideDrawer';
import { 
    CodeIcon, 
    SparklesIcon, 
    ArrowUpIcon, 
    GridIcon,
    PdfIcon,
    MarkdownIcon,
    FileTextIcon
} from './components/Icons';

type AIProvider = 'gemini' | 'mistral' | 'openrouter' | 'huggingface';

// --- Sub-components ---

const UndoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-15 9 9 0 0 0-6 2.3L3 7"/></svg>
);

const ChatLog = ({ messages, onUndo, canUndo }: { messages: Message[], onUndo: () => void, canUndo: boolean }) => {
    const bottomRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <div className="chat-log">
            {messages.map((msg) => (
                <div key={msg.id} className={`chat-message ${msg.role}`}>
                    <div className="chat-bubble">
                        <div className="chat-role">{msg.role === 'user' ? 'Engineering' : 'The Scribe'}</div>
                        <div className="chat-content">
                            {msg.parts.map((part, i) => (
                                <div key={i}>{part.text}</div>
                            ))}
                        </div>
                    </div>
                </div>
            ))}
            <div ref={bottomRef} />
            {canUndo && (
                <div className="undo-action-area">
                    <button className="undo-button" onClick={onUndo}>
                        <UndoIcon /> Undo Last AI Change
                    </button>
                </div>
            )}
        </div>
    );
};

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
                'gemini-flash-lite-latest'
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
  const [placeholders] = useState<string[]>(INITIAL_PLACEHOLDERS);
  const [placeholderIndex] = useState(0);
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

  /**
   * Refined manual update handler using stable references and session/artifact IDs
   */
  const handleArtifactUpdate = useCallback((newHtml: string, sessionId: string, artifactId: string) => {
    setSessions(prev => prev.map(session => 
        session.id === sessionId ? {
            ...session,
            artifacts: session.artifacts.map(art => 
                art.id === artifactId ? { ...art, html: newHtml } : art
            )
        } : session
    ));
  }, []);

  /**
   * Reverts to the previous session in the history stack.
   */
  const handleUndo = useCallback(() => {
      if (currentSessionIndex <= 0 || isLoading) return;
      
      const newIndex = currentSessionIndex - 1;
      setSessions(prev => prev.slice(0, currentSessionIndex)); // Remove the last session
      setCurrentSessionIndex(newIndex);
  }, [currentSessionIndex, isLoading]);

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
      if (focusedArtifactIndex === null || currentSessionIndex === -1) return;
      const session = sessions[currentSessionIndex];
      const artifactId = session.artifacts[focusedArtifactIndex].id;
      handleArtifactUpdate(html, session.id, artifactId);
      setDrawerState(s => ({ ...s, isOpen: false }));
  };

  const handleExport = (format: 'pdf' | 'md' | 'txt' | 'docx' | 'html') => {
    const currentSession = currentSessionIndex >= 0 ? sessions[currentSessionIndex] : null;
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

  /**
   * Aggregates relevant history and focused artifact context (US-102).
   */
  const buildContext = (session: Session | null, focusedArtifact?: Artifact, trimmedInput?: string) => {
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

    const userParts: any[] = [{ text: trimmedInput || "Turn context" }];
    attachments.forEach(att => {
        if (!seenAttachmentIds.has(att.id)) {
            historicalAttachments.push(att);
            seenAttachmentIds.add(att.id);
        }
        userParts.push({ inlineData: { data: att.base64, mimeType: att.mimeType } });
    });

    if (focusedArtifact) {
        userParts.push({ text: `
[CURRENT DOCUMENT STATE]
${focusedArtifact.html}

[TARGETED REFINEMENT TASK]
Goal: "${trimmedInput}". 
Process the update while maintaining the SCRIBE persona and styling.
Output the COMPLETE updated HTML document.
        ` });
    }

    const contents = session ? session.messages.map(m => ({ role: m.role, parts: m.parts })) : [];
    contents.push({ role: 'user', parts: userParts });

    return { contents, historicalAttachments };
  };

  /**
   * US-202: Targeted Refinement of a single focused document.
   */
  const handleTargetedEdit = async (trimmedInput: string) => {
    const lastSession = sessions[currentSessionIndex];
    if (!lastSession || focusedArtifactIndex === null) return;
    
    const targetArtifact = lastSession.artifacts[focusedArtifactIndex];

    if (targetArtifact.html.length > 1000000) {
        alert("The current document is exceptionally large (>1MB). To maintain quality, consider reducing content before further refinement.");
        setIsLoading(false);
        return;
    }

    const sessionId = generateId();
    
    const newArtifacts: Artifact[] = lastSession.artifacts.map((art, i) => 
        i === focusedArtifactIndex ? { ...art, id: `${sessionId}_${i}`, status: 'streaming' as const } : { ...art, id: `${sessionId}_${i}` }
    );

    const { contents } = buildContext(lastSession, targetArtifact, trimmedInput);
    
    const newUserMessage: Message = {
        id: generateId(),
        role: 'user',
        parts: contents[contents.length - 1].parts,
        timestamp: Date.now()
    };

    const newSession: Session = {
        id: sessionId,
        prompt: trimmedInput,
        timestamp: Date.now(),
        artifacts: newArtifacts,
        messages: [...lastSession.messages, newUserMessage],
        attachments: [...attachments],
        activeArtifactId: newArtifacts[focusedArtifactIndex].id
    };

    setAttachments([]);
    setSessions(prev => [...prev, newSession]);
    setCurrentSessionIndex(sessions.length);

    const apiKey = apiKeys[activeProvider];
    let accumulated = '';

    try {
        await adapters[activeProvider].generateStream(apiKey, {
            model: activeModel,
            contents,
            config: { systemInstruction: KB_EDIT_SYSTEM_INSTRUCTION },
            onChunk: (chunk) => {
                accumulated += chunk;
                const processedHtml = cleanHtml(accumulated);
                setSessions(prev => prev.map(sess => 
                    sess.id === sessionId ? { 
                        ...sess, 
                        artifacts: sess.artifacts.map(a => 
                            a.id === newArtifacts[focusedArtifactIndex].id ? { ...a, html: processedHtml } : a
                        ) 
                    } : sess
                ));
            }
        });

        const finalHtml = cleanHtml(accumulated);
        const finalModelMessage: Message = {
            id: generateId(),
            role: 'model',
            parts: [{ text: "Targeted refinement complete. Document updated according to Engineering specifications." }],
            timestamp: Date.now()
        };

        setSessions(prev => prev.map(sess => 
            sess.id === sessionId ? { 
                ...sess, 
                messages: [...sess.messages, finalModelMessage],
                artifacts: sess.artifacts.map(a => 
                    a.id === newArtifacts[focusedArtifactIndex].id ? { ...a, status: 'complete' as const, html: finalHtml } : a
                )
            } : sess
        ));
    } catch (e: any) {
        setSessions(prev => prev.map(sess => 
            sess.id === sessionId ? { 
                ...sess, 
                artifacts: sess.artifacts.map(a => 
                    a.id === newArtifacts[focusedArtifactIndex].id ? { ...a, status: 'error' as const, html: `<p style="color:red; padding: 20px;">Error: ${e.message}</p>` } : a
                )
            } : sess
        ));
    } finally {
        setIsLoading(false);
    }
  };

  /**
   * Refactored batch mode generation logic.
   */
  const handleGeneration = async (trimmedInput: string) => {
    const sessionId = generateId();
    const styles = ["Technical SOP", "Checklist", "Incident Log", "Troubleshooting Guide", "Brief Anecdote", "How-to Guide"];
    const lastSession = currentSessionIndex >= 0 ? sessions[currentSessionIndex] : null;

    const placeholderArtifacts: Artifact[] = styles.map((style, i) => ({
        id: `${sessionId}_${i}`, styleName: style, html: '', status: 'streaming'
    }));
    
    const { contents } = buildContext(lastSession, undefined, trimmedInput);

    const newUserMessage: Message = {
        id: generateId(),
        role: 'user',
        parts: contents[contents.length - 1].parts,
        timestamp: Date.now()
    };

    const newSession: Session = {
        id: sessionId,
        prompt: trimmedInput || (lastSession ? `Suite Refinement: ${lastSession.prompt}` : "Batch Documentation Generation"),
        timestamp: Date.now(),
        artifacts: placeholderArtifacts,
        messages: lastSession ? [...lastSession.messages, newUserMessage] : [newUserMessage],
        attachments: [...attachments]
    };

    setAttachments([]);
    setSessions(prev => [...prev, newSession]);
    setCurrentSessionIndex(sessions.length);

    const apiKey = apiKeys[activeProvider];

    try {
        await Promise.all(placeholderArtifacts.map(async (art, i) => {
            await wait(i * 300);
            const style = styles[i];
            
            let systemInstruction = KB_SOP_SYSTEM_INSTRUCTION;
            if (style === "Troubleshooting Guide") systemInstruction = KB_TROUBLESHOOTING_SYSTEM_INSTRUCTION;
            else if (style === "How-to Guide") systemInstruction = KB_HOW_TO_SYSTEM_INSTRUCTION;
            else if (style === "Brief Anecdote") systemInstruction = KB_ANECDOTE_SYSTEM_INSTRUCTION;
            else if (style === "Checklist") systemInstruction = KB_CHECKLIST_SYSTEM_INSTRUCTION;
            else if (style === "Incident Log") systemInstruction = KB_INCIDENT_SYSTEM_INSTRUCTION;

            let accumulated = '';
            try {
                await adapters[activeProvider].generateStream(apiKey, {
                    model: activeModel,
                    contents,
                    config: { systemInstruction },
                    onChunk: (chunk) => {
                        accumulated += chunk;
                        const processedHtml = cleanHtml(accumulated);
                        setSessions(prev => prev.map(sess => sess.id === sessionId ? { ...sess, artifacts: sess.artifacts.map(a => a.id === art.id ? { ...a, html: processedHtml } : a) } : sess));
                    }
                });

                const finalCleaned = cleanHtml(accumulated);
                setSessions(prev => prev.map(sess => sess.id === sessionId ? { ...sess, artifacts: sess.artifacts.map(a => a.id === art.id ? { ...a, status: 'complete' as const, html: finalCleaned } : a) } : sess));
            } catch (e: any) {
                setSessions(prev => prev.map(sess => sess.id === sessionId ? { ...sess, artifacts: sess.artifacts.map(a => a.id === art.id ? { ...a, status: 'error', html: `<p style="color:red; padding: 20px;">Error: ${e.message}</p>` } : a) } : sess));
            }
        }));

        const finalModelMessage: Message = {
            id: generateId(),
            role: 'model',
            parts: [{ text: "Documentation suite generated. Review the artifacts for technical accuracy." }],
            timestamp: Date.now()
        };
        setSessions(prev => prev.map(sess => sess.id === sessionId ? { ...sess, messages: [...sess.messages, finalModelMessage] } : sess));

    } catch (e) { console.error("Fatal session error", e); } finally { setIsLoading(false); }
  };

  /**
   * US-201: Intent Router based on focus state.
   */
  const handleSendMessage = useCallback(async (manualPrompt?: string) => {
    const promptToUse = manualPrompt || inputValue;
    const trimmedInput = promptToUse.trim();
    if (!trimmedInput && attachments.length === 0) return;
    if (isLoading) return;
    if (!manualPrompt) setInputValue('');

    setIsLoading(true);

    if (focusedArtifactIndex !== null) {
        handleTargetedEdit(trimmedInput);
    } else {
        handleGeneration(trimmedInput);
    }
  }, [inputValue, isLoading, sessions, currentSessionIndex, apiKeys, activeProvider, activeModel, attachments, focusedArtifactIndex]);

  const hasStarted = sessions.length > 0 || isLoading;
  const currentSession = currentSessionIndex >= 0 ? sessions[currentSessionIndex] : null;

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
                                    onUpdate={(html) => handleArtifactUpdate(html, session.id, artifact.id)}
                                    onClick={() => setFocusedArtifactIndex(aIndex)} 
                                />
                            ))}
                        </div>
                        {focusedArtifactIndex !== null && sIndex === currentSessionIndex && (
                            <div className="focus-chat-panel">
                                <div className="focus-chat-header">Conversation History</div>
                                <ChatLog 
                                    messages={session.messages} 
                                    onUndo={handleUndo} 
                                    canUndo={currentSessionIndex > 0} 
                                />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className={`action-bar ${focusedArtifactIndex !== null ? 'visible' : ''}`}>
                 <div className="active-prompt-label">
                     {focusedArtifactIndex !== null ? `Refining Document: ${currentSession?.artifacts[focusedArtifactIndex].styleName}` : currentSession?.prompt}
                 </div>
                 <div className="action-buttons-wrapper">
                    <div className="action-buttons">
                        <div className="btn-group">
                            <button onClick={() => { setFocusedArtifactIndex(null); setIsEditing(false); }}><GridIcon /> View All</button>
                        </div>
                        <div className="btn-group main-actions">
                            <button onClick={() => setIsEditing(!isEditing)} className={isEditing ? 'active' : ''} disabled={isLoading}>
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
                            <input ref={inputRef} type="text" placeholder={focusedArtifactIndex !== null ? "Ask for a specific change to this document..." : (sessions.length > 0 ? "Refine these documents..." : "What do we need to document?")} value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} disabled={isLoading} />
                        </div>
                        <button className="send-button" onClick={() => handleSendMessage()} disabled={isLoading || (!inputValue.trim() && attachments.length === 0)}><ArrowUpIcon /></button>
                    </div>
                    {focusedArtifactIndex !== null && <div className="mode-hint" style={{ fontSize: '0.7rem', color: '#60a5fa', textAlign: 'center', marginTop: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Targeted Edit Mode Active</div>}
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