import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function FileCard({ file, isOwner, onToggleDownload, onShare, onDelete }) {
    const [shareEmail, setShareEmail] = useState('');
    const [showShareForm, setShowShareForm] = useState(false);

    function handleShare(e) {
        e.preventDefault();
        onShare(shareEmail);
        setShareEmail('');
        setShowShareForm(false);
    }

    function getFileIcon() {
        if (file.isFolder) {
            return '📁';
        } else if (file.type.includes('image')) {
            return '🖼️';
        } else if (file.type.includes('video')) {
            return '🎬';
        } else if (file.type.includes('audio')) {
            return '🎵';
        } else if (file.type.includes('pdf')) {
            return '📄';
        } else {
            return '📄';
        }
    }

    return (
        <div className="card h-100">
            <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-2">
                    <h5 className="card-title text-truncate">{getFileIcon()} {file.name}</h5>
                    {isOwner && (
                        <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={onDelete}
                            title="Delete file"
                        >
                            ×
                        </button>
                    )}
                </div>
                <p className="card-text">
                    <small className="text-muted">
                        {file.isFolder ? 'Folder' : `Size: ${(file.size / 1024).toFixed(2)} KB`}
                    </small>
                </p>
                <p className="card-text">
                    <small className="text-muted">
                        {isOwner ? 'Owned by you' : `Shared by: ${file.ownerEmail}`}
                    </small>
                </p>

                <div className="d-grid gap-2">
                    <Link to={`/file/${file.id}`} className="btn btn-primary">
                        {file.isFolder ? 'Open Folder' : 'View File'}
                    </Link>

                    {isOwner && (
                        <>
                            <button
                                className="btn btn-outline-primary"
                                onClick={() => setShowShareForm(!showShareForm)}
                            >
                                Share
                            </button>

                            {!file.isFolder && (
                                <button
                                    className={`btn ${file.allowDownload ? 'btn-success' : 'btn-outline-secondary'}`}
                                    onClick={onToggleDownload}
                                >
                                    {file.allowDownload ? 'Downloads Enabled' : 'Enable Downloads'}
                                </button>
                            )}
                        </>
                    )}
                </div>

                {showShareForm && (
                    <form onSubmit={handleShare} className="mt-3">
                        <div className="input-group">
                            <input
                                type="email"
                                className="form-control"
                                placeholder="Email to share with"
                                value={shareEmail}
                                onChange={(e) => setShareEmail(e.target.value)}
                                required
                            />
                            <button type="submit" className="btn btn-outline-primary">
                                Share
                            </button>
                        </div>
                    </form>
                )}

                {file.sharedWith && file.sharedWith.length > 0 && (
                    <div className="mt-3">
                        <small className="text-muted">
                            Shared with: {file.sharedWith.join(', ')}
                        </small>
                    </div>
                )}
            </div>
        </div>
    );
} 