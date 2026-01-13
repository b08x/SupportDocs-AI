import React, { useRef, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { 
    Bold, 
    Italic, 
    Heading1, 
    Heading2, 
    List, 
    ListOrdered,
    Image as ImageIcon
} from 'lucide-react';

interface EditorProps {
    content: string;
    onUpdate: (html: string) => void;
}

const Editor = ({ content, onUpdate }: EditorProps) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const onUpdateRef = useRef(onUpdate);

    // Keep the update callback ref fresh to avoid stale closures in Tiptap's listener
    useEffect(() => {
        onUpdateRef.current = onUpdate;
    }, [onUpdate]);

    const editor = useEditor({
        extensions: [
            StarterKit,
            Image.configure({
                inline: true,
                allowBase64: true,
                HTMLAttributes: {
                    class: 'max-w-full h-auto rounded-lg border border-gray-200 shadow-sm my-4',
                },
            }),
        ],
        content: content,
        onUpdate: ({ editor }) => {
            onUpdateRef.current(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'prose prose-invert max-w-none focus:outline-none tiptap-content',
            },
        },
    });

    // Synchronize external content changes (e.g., from AI streaming) into the editor
    useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            editor.commands.setContent(content, false);
        }
    }, [content, editor]);

    if (!editor) {
        return null;
    }

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64 = e.target?.result as string;
                if (base64) {
                    editor.chain().focus().setImage({ src: base64 }).run();
                }
            };
            reader.readAsDataURL(file);
        }
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="editor-container">
            <div className="editor-toolbar">
                <button
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    disabled={!editor.can().chain().focus().toggleBold().run()}
                    className={editor.isActive('bold') ? 'is-active' : ''}
                    title="Bold"
                >
                    <Bold size={16} />
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    disabled={!editor.can().chain().focus().toggleItalic().run()}
                    className={editor.isActive('italic') ? 'is-active' : ''}
                    title="Italic"
                >
                    <Italic size={16} />
                </button>
                <div className="toolbar-divider" style={{ width: '1px', height: '20px', background: '#e4e4e7', margin: '0 4px' }} />
                <button
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}
                    title="Heading 1"
                >
                    <Heading1 size={16} />
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}
                    title="Heading 2"
                >
                    <Heading2 size={16} />
                </button>
                <div className="toolbar-divider" style={{ width: '1px', height: '20px', background: '#e4e4e7', margin: '0 4px' }} />
                <button
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={editor.isActive('bulletList') ? 'is-active' : ''}
                    title="Bullet List"
                >
                    <List size={16} />
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={editor.isActive('orderedList') ? 'is-active' : ''}
                    title="Ordered List"
                >
                    <ListOrdered size={16} />
                </button>
                <div className="toolbar-divider" style={{ width: '1px', height: '20px', background: '#e4e4e7', margin: '0 4px' }} />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    title="Insert Image"
                    className="image-upload-btn"
                >
                    <ImageIcon size={16} />
                </button>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    style={{ display: 'none' }} 
                    accept="image/*" 
                    onChange={handleImageUpload} 
                />
            </div>
            <div className="editor-scroll-area">
                <EditorContent editor={editor} />
            </div>
        </div>
    );
};

export default Editor;