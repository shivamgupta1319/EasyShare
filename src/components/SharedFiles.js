/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getSharedFiles } from '../services/localDataService';
import FileCard from './FileCard';

export default function SharedFiles() {
    const [sharedFiles, setSharedFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const { currentUser } = useAuth();

    useEffect(() => {
        async function fetchSharedFiles() {
            if (!currentUser) return;

            try {
                setLoading(true);
                const files = await getSharedFiles(currentUser.email);
                setSharedFiles(files);
                setError('');
            } catch (err) {
                setError('Failed to load shared files');
            } finally {
                setLoading(false);
            }
        }

        fetchSharedFiles();
    }, [currentUser]);

    return (
        <div className="container">
            <h2 className="mb-4">Files Shared With Me</h2>

            {loading ? (
                <div className="text-center">
                    <div className="spinner-border" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                </div>
            ) : error ? (
                <div className="alert alert-danger">{error}</div>
            ) : sharedFiles.length > 0 ? (
                <div className="row">
                    {sharedFiles.map(file => (
                        <div className="col-md-4 mb-3" key={file.id}>
                            <FileCard
                                file={file}
                                isOwner={false}
                                onToggleDownload={() => { }}
                            />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="alert alert-info">
                    No files have been shared with you yet.
                </div>
            )}
        </div>
    );
}