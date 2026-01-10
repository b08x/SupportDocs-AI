
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { Artifact } from '../types';
import Editor from './Editor';

interface ArtifactCardProps {
    artifact: Artifact;
    isFocused: boolean;
    onClick: () => void;
    isEditing?: boolean;
    onUpdate?: (newHtml: string) => void;
}

const ArtifactCard = React.memo(({ 
    artifact, 
    isFocused, 
    onClick,
    isEditing = false,
    onUpdate
}: ArtifactCardProps) => {
    const isBlurring = artifact.status === 'streaming';

    return (
        <div 
            className={`artifact-card ${isFocused ? 'focused' : ''} ${isBlurring ? 'generating' : ''} ${isEditing ? 'editing' : ''}`}
            onClick={onClick}
        >
            <div className="artifact-header">
                <span className="artifact-style-tag">{artifact.styleName}</span>
                {isBlurring && <span className="status-indicator drafting">Drafting...</span>}
                {isEditing && <span className="status-indicator editing">Editing Mode</span>}
            </div>
            <div className="artifact-card-inner">
                {isBlurring && (
                    <div className="generating-loader-overlay">
                        <div className="loader-bars">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                    </div>
                )}
                
                {isEditing && onUpdate ? (
                    <Editor 
                        content={artifact.html} 
                        onUpdate={onUpdate} 
                    />
                ) : (
                    <iframe 
                        srcDoc={artifact.html} 
                        title={artifact.id} 
                        sandbox="allow-scripts allow-forms allow-modals allow-popups allow-presentation allow-same-origin"
                        className="artifact-iframe"
                    />
                )}
            </div>
        </div>
    );
});

export default ArtifactCard;
