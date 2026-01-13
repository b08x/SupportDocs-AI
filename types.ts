
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export interface Artifact {
  id: string;
  styleName: string;
  html: string;
  status: 'streaming' | 'complete' | 'error';
}

export interface Message {
    id: string;
    role: 'user' | 'model';
    parts: any[];
    timestamp: number;
}

export interface Session {
    id: string;
    prompt: string;
    timestamp: number;
    artifacts: Artifact[];
    messages: Message[];
    activeArtifactId?: string;
    attachments?: FileAttachment[];
}

export interface ComponentVariation { name: string; html: string; }
export interface LayoutOption { name: string; css: string; previewHtml: string; }

export interface GenerateParams {
    model: string;
    contents: any[];
    config?: any;
    onChunk: (text: string) => void;
}

export interface AIAdapter {
    fetchModels(apiKey: string): Promise<string[]>;
    generateStream(apiKey: string, params: GenerateParams): Promise<void>;
}

export interface FileAttachment {
    id: string;
    file: File;
    name: string;
    base64: string;
    mimeType: string;
}

/**
 * Story 5: Standardized message interface for OpenAI-compatible and string-based models.
 */
export interface UnifiedMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
