
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI } from '@google/genai';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';

import { Artifact, Session, ComponentVariation } from './types';
import { INITIAL_PLACEHOLDERS } from './constants';
import { generateId } from './utils';

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
    DownloadIcon,
    FileTextIcon,
    MarkdownIcon,
    PdfIcon
} from './components/Icons';

interface FileAttachment {
    id: string;
    file: File;
    name: string;
    base64: string;
    mimeType: string;
}

const PaperclipIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.51a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
);

const XIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
);

const ResetIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
);

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
  
  const [drawerState, setDrawerState] = useState<{
      isOpen: boolean;
      mode: 'code' | 'variations' | null;
      title: string;
      data: any; 
  }>({ isOpen: false, mode: null, title: '', data: null });

  const [componentVariations, setComponentVariations] = useState<ComponentVariation[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (focusedArtifactIndex !== null && window.innerWidth <= 1024) {
        if (gridScrollRef.current) {
            gridScrollRef.current.scrollTop = 0;
        }
        window.scrollTo(0, 0);
    }
  }, [focusedArtifactIndex]);

  useEffect(() => {
      const interval = setInterval(() => {
          setPlaceholderIndex(prev => (prev + 1) % placeholders.length);
      }, 3000);
      return () => clearInterval(interval);
  }, [placeholders.length]);

  useEffect(() => {
      const fetchDynamicPlaceholders = async () => {
          try {
              const apiKey = process.env.API_KEY;
              if (!apiKey) return;
              const ai = new GoogleGenAI({ apiKey });
              const response = await ai.models.generateContent({
                  model: 'gemini-3-flash-preview',
                  contents: { 
                      role: 'user', 
                      parts: [{ 
                          text: 'Generate 20 creative IT support technical writing prompts (e.g. "SOP for cloud instance recovery", "How-to guide for YubiKey provisioning"). Return ONLY a raw JSON array of strings.' 
                      }] 
                  }
              });
              const text = response.text || '[]';
              const jsonMatch = text.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                  const newPlaceholders = JSON.parse(jsonMatch[0]);
                  if (Array.isArray(newPlaceholders) && newPlaceholders.length > 0) {
                      const shuffled = newPlaceholders.sort(() => 0.5 - Math.random()).slice(0, 10);
                      setPlaceholders(prev => [...prev, ...shuffled]);
                  }
              }
          } catch (e) {
              console.warn("Silently failed to fetch dynamic placeholders", e);
          }
      };
      setTimeout(fetchDynamicPlaceholders, 1000);
  }, []);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const fileList = Array.from(files) as File[];
    for (const file of fileList) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result as string;
            const base64 = result.split(',')[1];
            const attachment: FileAttachment = {
                id: generateId(),
                file,
                name: file.name,
                base64,
                mimeType: file.type || 'application/octet-stream'
            };
            setAttachments(prev => [...prev, attachment]);
        };
        reader.readAsDataURL(file);
    }
    event.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleReset = () => {
    setSessions([]);
    setCurrentSessionIndex(-1);
    setFocusedArtifactIndex(null);
    setAttachments([]);
    setInputValue('');
    setIsResetConfirming(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const parseJsonStream = async function* (responseStream: any) {
      let buffer = '';
      for await (const chunk of responseStream) {
          const text = chunk.text;
          if (typeof text !== 'string') continue;
          buffer += text;
          let braceCount = 0;
          let start = buffer.indexOf('{');
          while (start !== -1) {
              braceCount = 0;
              let end = -1;
              for (let i = start; i < buffer.length; i++) {
                  if (buffer[i] === '{') braceCount++;
                  else if (buffer[i] === '}') braceCount--;
                  if (braceCount === 0 && i > start) {
                      end = i;
                      break;
                  }
              }
              if (end !== -1) {
                  const jsonString = buffer.substring(start, end + 1);
                  try {
                      yield JSON.parse(jsonString);
                      buffer = buffer.substring(end + 1);
                      start = buffer.indexOf('{');
                  } catch (e) {
                      start = buffer.indexOf('{', start + 1);
                  }
              } else {
                  break; 
              }
          }
      }
  };

  const handleGenerateVariations = useCallback(async () => {
    const currentSession = sessions[currentSessionIndex];
    if (!currentSession || focusedArtifactIndex === null) return;
    const currentArtifact = currentSession.artifacts[focusedArtifactIndex];

    setIsLoading(true);
    setComponentVariations([]);
    setDrawerState({ isOpen: true, mode: 'variations', title: 'Audience Adapts', data: currentArtifact.id });

    try {
        const apiKey = process.env.API_KEY;
        if (!apiKey) throw new Error("API_KEY is not configured.");
        const ai = new GoogleGenAI({ apiKey });

        const prompt = `
You are a Lead IT Documentation Specialist. Rewrite the following document concept for 3 DIFFERENT AUDIENCES:
Concept: "${currentSession.prompt}"

1. **Executive Summary**: Focus on business impact, risk mitigation, and high-level outcomes. Zero technical jargon.
2. **Deep-Dive Engineer**: Focus on log paths, registry keys, terminal commands, and edge-case failure modes.
3. **Internal Anecdote**: Frame it as a "lesson learned" from a real (hypothetical) support incident.

Required JSON Output Format (stream ONE object per line):
{ "name": "Audience Name", "html": "High-fidelity HTML content with clean CSS" }
        `.trim();

        const responseStream = await ai.models.generateContentStream({
            model: 'gemini-3-flash-preview',
             contents: [{ parts: [{ text: prompt }], role: 'user' }],
             config: { temperature: 1.0 }
        });

        for await (const variation of parseJsonStream(responseStream)) {
            if (variation.name && variation.html) {
                setComponentVariations(prev => [...prev, variation]);
            }
        }
    } catch (e: any) {
        console.error("Error generating variations:", e);
    } finally {
        setIsLoading(false);
    }
  }, [sessions, currentSessionIndex, focusedArtifactIndex]);

  const applyVariation = (html: string) => {
      if (focusedArtifactIndex === null) return;
      setSessions(prev => prev.map((sess, i) => 
          i === currentSessionIndex ? {
              ...sess,
              artifacts: sess.artifacts.map((art, j) => 
                j === focusedArtifactIndex ? { ...art, html, status: 'complete' } : art
              )
          } : sess
      ));
      setDrawerState(s => ({ ...s, isOpen: false }));
  };

  const handleShowCode = () => {
      const currentSession = sessions[currentSessionIndex];
      if (currentSession && focusedArtifactIndex !== null) {
          const artifact = currentSession.artifacts[focusedArtifactIndex];
          setDrawerState({ isOpen: true, mode: 'code', title: 'Raw Document Source', data: artifact.html });
      }
  };

  const handleExport = (format: 'pdf' | 'md' | 'txt') => {
    const currentSession = sessions[currentSessionIndex];
    if (!currentSession || focusedArtifactIndex === null) return;
    const artifact = currentSession.artifacts[focusedArtifactIndex];
    const fileName = `${artifact.styleName.replace(/\s+/g, '_')}_${Date.now()}`;

    if (format === 'pdf') {
        const fullHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>${artifact.styleName}</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #111; }
                    .print-header { border-bottom: 2px solid #eee; margin-bottom: 30px; padding-bottom: 10px; font-size: 0.8rem; color: #666; }
                    @media print { .no-print { display: none; } }
                </style>
            </head>
            <body>
                <div class="print-header no-print">SupportDocs AI Generated PDF Export. Use Ctrl+P or Cmd+P to save as PDF.</div>
                ${artifact.html}
                <script>
                    window.onload = () => {
                        // Attempt print, will likely be ignored if sandboxed but provided as shortcut
                        setTimeout(() => {
                            try { window.print(); } catch(e) {}
                        }, 500);
                    };
                </script>
            </body>
            </html>
        `;
        const blob = new Blob([fullHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const win = window.open(url, '_blank');
        // No alert if blocked by sandbox, just let it happen or not.
    } else {
        let content = '';
        let mimeType = 'text/plain';
        let extension = '';

        if (format === 'md') {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = artifact.html;
            const style = tempDiv.querySelector('style');
            if (style) style.remove();
            content = tempDiv.innerText || tempDiv.textContent || '';
            mimeType = 'text/markdown';
            extension = 'md';
        } else {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = artifact.html;
            content = tempDiv.innerText || tempDiv.textContent || '';
            mimeType = 'text/plain';
            extension = 'txt';
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileName}.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
  };

  const handleSendMessage = useCallback(async (manualPrompt?: string) => {
    const promptToUse = manualPrompt || inputValue;
    const trimmedInput = promptToUse.trim();
    
    if (!trimmedInput || isLoading) return;
    if (!manualPrompt) setInputValue('');

    setIsLoading(true);
    const baseTime = Date.now();
    const sessionId = generateId();

    const placeholderArtifacts: Artifact[] = Array(3).fill(null).map((_, i) => ({
        id: `${sessionId}_${i}`,
        styleName: 'Drafting...',
        html: '',
        status: 'streaming',
    }));

    const contextHistory: any[] = [];
    sessions.forEach(sess => {
        contextHistory.push({ role: 'user', parts: [{ text: sess.prompt }] });
        const sessionOutput = sess.artifacts
            .filter(a => a.status === 'complete')
            .map(a => `[ARCHETYPE: ${a.styleName}]\n${a.html}`)
            .join('\n\n');
        if (sessionOutput) {
            contextHistory.push({ role: 'model', parts: [{ text: `I generated these documents for that request:\n\n${sessionOutput}` }] });
        }
    });

    const newSession: Session = {
        id: sessionId,
        prompt: trimmedInput,
        timestamp: baseTime,
        artifacts: placeholderArtifacts
    };

    const currentAttachments = [...attachments];
    setAttachments([]); 
    setSessions(prev => [...prev, newSession]);
    setCurrentSessionIndex(sessions.length); 
    setFocusedArtifactIndex(null); 

    try {
        const apiKey = process.env.API_KEY;
        if (!apiKey) throw new Error("API_KEY is not configured.");
        const ai = new GoogleGenAI({ apiKey });

        const stylePrompt = `
You are a Principal IT Systems Engineer. 
We are working on a documentation thread. 
Based on our history and this new request: "${trimmedInput}", 
propose 3 distinct documentation archetypes to address this update or new topic.
Return ONLY a raw JSON array of 3 strings.
        `.trim();

        const styleResponse = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [...contextHistory, { role: 'user', parts: [{ text: stylePrompt }] }]
        });

        let generatedStyles: string[] = [];
        const styleText = styleResponse.text || '[]';
        const jsonMatch = styleText.match(/\[[\s\S]*\]/);
        
        if (jsonMatch) {
            try {
                generatedStyles = JSON.parse(jsonMatch[0]);
            } catch (e) {
                console.warn("Failed to parse styles, using fallbacks");
            }
        }

        if (!generatedStyles || generatedStyles.length < 3) {
            generatedStyles = [
                "Standard Knowledge Base",
                "Technical Quick-Ref",
                "Support War Story"
            ];
        }
        
        generatedStyles = generatedStyles.slice(0, 3);

        setSessions(prev => prev.map(s => {
            if (s.id !== sessionId) return s;
            return {
                ...s,
                artifacts: s.artifacts.map((art, i) => ({
                    ...art,
                    styleName: generatedStyles[i]
                }))
            };
        }));

        const generateArtifact = async (artifact: Artifact, styleInstruction: string) => {
            try {
                const currentParts: any[] = [{ text: `
You are a Senior IT Technical Writer. 
Continue our documentation project based on the latest instruction: "${trimmedInput}".
ARCHETYPE for this specific output: ${styleInstruction}

**INSTRUCTIONS:**
1. Maintain consistency with the context of previous documents in this session.
2. If this is a request to "add", "change", or "refine", apply those edits while preserving the core technical accuracy.
3. Use HTML/CSS, <kbd>, <code>, and clear hierarchies.
4. Source Material: If any files are attached (images, PDFs, or logs), strictly use their content.

Return ONLY RAW HTML. Do not wrap in markdown code blocks.
Include a <style> block that uses 'Inter' font and makes it look like a high-end documentation portal.
          `.trim() }];

                for (const att of currentAttachments) {
                    currentParts.push({
                        inlineData: {
                            data: att.base64,
                            mimeType: att.mimeType
                        }
                    });
                }
          
                const responseStream = await ai.models.generateContentStream({
                    model: 'gemini-3-flash-preview',
                    contents: [...contextHistory, { role: "user", parts: currentParts }],
                });

                let accumulatedHtml = '';
                for await (const chunk of responseStream) {
                    const text = chunk.text;
                    if (typeof text === 'string') {
                        accumulatedHtml += text;
                        setSessions(prev => prev.map(sess => 
                            sess.id === sessionId ? {
                                ...sess,
                                artifacts: sess.artifacts.map(art => 
                                    art.id === artifact.id ? { ...art, html: accumulatedHtml } : art
                                )
                            } : sess
                        ));
                    }
                }
                
                let finalHtml = accumulatedHtml.trim();
                if (finalHtml.startsWith('```html')) finalHtml = finalHtml.substring(7).trimStart();
                if (finalHtml.startsWith('```')) finalHtml = finalHtml.substring(3).trimStart();
                if (finalHtml.endsWith('```')) finalHtml = finalHtml.substring(0, finalHtml.length - 3).trimEnd();

                setSessions(prev => prev.map(sess => 
                    sess.id === sessionId ? {
                        ...sess,
                        artifacts: sess.artifacts.map(art => 
                            art.id === artifact.id ? { ...art, html: finalHtml, status: finalHtml ? 'complete' : 'error' } : art
                        )
                    } : sess
                ));

            } catch (e: any) {
                console.error('Error generating artifact:', e);
                setSessions(prev => prev.map(sess => 
                    sess.id === sessionId ? {
                        ...sess,
                        artifacts: sess.artifacts.map(art => 
                            art.id === artifact.id ? { ...art, html: `<div style="color: #ff6b6b; padding: 20px;">Error: ${e.message}</div>`, status: 'error' } : art
                        )
                    } : sess
                ));
            }
        };

        await Promise.all(placeholderArtifacts.map((art, i) => generateArtifact(art, generatedStyles[i])));

    } catch (e) {
        console.error("Fatal error in generation process", e);
    } finally {
        setIsLoading(false);
        setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [inputValue, isLoading, sessions, attachments]);

  const handleSurpriseMe = () => {
      const currentPrompt = placeholders[placeholderIndex];
      setInputValue(currentPrompt);
      handleSendMessage(currentPrompt);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !isLoading) {
      event.preventDefault();
      handleSendMessage();
    } else if (event.key === 'Tab' && !inputValue && !isLoading) {
        event.preventDefault();
        setInputValue(placeholders[placeholderIndex]);
    }
  };

  const nextItem = useCallback(() => {
      if (focusedArtifactIndex !== null) {
          if (focusedArtifactIndex < 2) setFocusedArtifactIndex(focusedArtifactIndex + 1);
      } else {
          if (currentSessionIndex < sessions.length - 1) setCurrentSessionIndex(currentSessionIndex + 1);
      }
  }, [currentSessionIndex, sessions.length, focusedArtifactIndex]);

  const prevItem = useCallback(() => {
      if (focusedArtifactIndex !== null) {
          if (focusedArtifactIndex > 0) setFocusedArtifactIndex(focusedArtifactIndex - 1);
      } else {
           if (currentSessionIndex > 0) setCurrentSessionIndex(currentSessionIndex - 1);
      }
  }, [currentSessionIndex, focusedArtifactIndex]);

  const isLoadingDrawer = isLoading && drawerState.mode === 'variations' && componentVariations.length === 0;

  const hasStarted = sessions.length > 0 || isLoading;
  const currentSession = sessions[currentSessionIndex];

  let canGoBack = false;
  let canGoForward = false;

  if (hasStarted) {
      if (focusedArtifactIndex !== null) {
          canGoBack = focusedArtifactIndex > 0;
          canGoForward = focusedArtifactIndex < (currentSession?.artifacts.length || 0) - 1;
      } else {
          canGoBack = currentSessionIndex > 0;
          canGoForward = currentSessionIndex < sessions.length - 1;
      }
  }

  return (
    <>
        <SideDrawer 
            isOpen={drawerState.isOpen} 
            onClose={() => setDrawerState(s => ({...s, isOpen: false}))} 
            title={drawerState.title}
        >
            {isLoadingDrawer && (
                 <div className="loading-state">
                     <ThinkingIcon /> 
                     Adapting for audiences...
                 </div>
            )}

            {drawerState.mode === 'code' && (
                <pre className="code-block"><code>{drawerState.data}</code></pre>
            )}
            
            {drawerState.mode === 'variations' && (
                <div className="sexy-grid">
                    {componentVariations.map((v, i) => (
                         <div key={i} className="sexy-card" onClick={() => applyVariation(v.html)}>
                             <div className="sexy-preview">
                                 <iframe srcDoc={v.html} title={v.name} sandbox="allow-scripts allow-same-origin" />
                             </div>
                             <div className="sexy-label">{v.name}</div>
                         </div>
                    ))}
                </div>
            )}
        </SideDrawer>

        <div className="immersive-app">
            <DottedGlowBackground 
                gap={24} 
                radius={1.5} 
                color="rgba(255, 255, 255, 0.02)" 
                glowColor="rgba(255, 255, 255, 0.15)" 
                speedScale={0.5} 
            />

            <div className="utility-bar">
                {sessions.length > 0 && (
                    <div className="reset-container">
                        {!isResetConfirming ? (
                            <button className="reset-session-btn" onClick={() => setIsResetConfirming(true)} title="Reset Session">
                                <ResetIcon /> Reset Session
                            </button>
                        ) : (
                            <div className="confirm-group">
                                <button className="reset-session-btn confirm" onClick={handleReset}>
                                    Confirm Reset?
                                </button>
                                <button className="reset-session-btn cancel" onClick={() => setIsResetConfirming(false)}>
                                    Cancel
                                </button>
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
                         <button className="surprise-button" onClick={handleSurpriseMe} disabled={isLoading}>
                             <SparklesIcon /> Random Topic
                         </button>
                     </div>
                 </div>

                {sessions.map((session, sIndex) => {
                    let positionClass = 'hidden';
                    if (sIndex === currentSessionIndex) positionClass = 'active-session';
                    else if (sIndex < currentSessionIndex) positionClass = 'past-session';
                    else if (sIndex > currentSessionIndex) positionClass = 'future-session';
                    
                    return (
                        <div key={session.id} className={`session-group ${positionClass}`}>
                            <div className="artifact-grid" ref={sIndex === currentSessionIndex ? gridScrollRef : null}>
                                {session.artifacts.map((artifact, aIndex) => {
                                    const isFocused = focusedArtifactIndex === aIndex;
                                    
                                    return (
                                        <ArtifactCard 
                                            key={artifact.id}
                                            artifact={artifact}
                                            isFocused={isFocused}
                                            onClick={() => setFocusedArtifactIndex(aIndex)}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

             {canGoBack && (
                <button className="nav-handle left" onClick={prevItem} aria-label="Previous">
                    <ArrowLeftIcon />
                </button>
             )}
             {canGoForward && (
                <button className="nav-handle right" onClick={nextItem} aria-label="Next">
                    <ArrowRightIcon />
                </button>
             )}

            <div className={`action-bar ${focusedArtifactIndex !== null ? 'visible' : ''}`}>
                 <div className="active-prompt-label">
                    {currentSession?.prompt}
                 </div>
                 <div className="action-buttons">
                    <div className="btn-group">
                        <button onClick={() => setFocusedArtifactIndex(null)} title="View All">
                            <GridIcon /> View All
                        </button>
                    </div>
                    
                    <div className="btn-group main-actions">
                        <button onClick={handleGenerateVariations} disabled={isLoading} title="Adapt for other audiences">
                            <SparklesIcon /> Audience Adapts
                        </button>
                        <button onClick={handleShowCode} title="View source code">
                            <CodeIcon /> Source
                        </button>
                    </div>

                    <div className="btn-group export-actions">
                        <button onClick={() => handleExport('pdf')} title="Export as PDF">
                            <PdfIcon /> PDF
                        </button>
                        <button onClick={() => handleExport('md')} title="Export as Markdown">
                            <MarkdownIcon /> MD
                        </button>
                        <button onClick={() => handleExport('txt')} title="Export as Plain Text">
                            <FileTextIcon /> TXT
                        </button>
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
                                    <button onClick={() => removeAttachment(att.id)} className="remove-att">
                                        <XIcon />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className={`input-wrapper ${isLoading ? 'loading' : ''}`}>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            style={{ display: 'none' }} 
                            onChange={handleFileChange} 
                            multiple 
                            accept=".pdf,image/*,.txt,.md,.log"
                        />
                        <button className="attachment-trigger" onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
                            <PaperclipIcon />
                        </button>
                        
                        <div className="input-main">
                            {(!inputValue && !isLoading) && (
                                <div className="animated-placeholder" key={placeholderIndex}>
                                    <span className="placeholder-text">{placeholders[placeholderIndex]}</span>
                                    <span className="tab-hint">Tab</span>
                                </div>
                            )}
                            {!isLoading ? (
                                <input 
                                    ref={inputRef}
                                    type="text" 
                                    placeholder={sessions.length > 0 ? "Refine these documents..." : "What do we need to document?"}
                                    value={inputValue} 
                                    onChange={handleInputChange} 
                                    onKeyDown={handleKeyDown} 
                                    disabled={isLoading} 
                                />
                            ) : (
                                <div className="input-generating-label">
                                    <span className="generating-prompt-text">{currentSession?.prompt}</span>
                                    <ThinkingIcon />
                                </div>
                            )}
                        </div>
                        <button className="send-button" onClick={() => handleSendMessage()} disabled={isLoading || (!inputValue.trim() && attachments.length === 0)}>
                            <ArrowUpIcon />
                        </button>
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
