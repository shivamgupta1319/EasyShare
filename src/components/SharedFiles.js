/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getSharedFiles } from '../services/localDataService';
import FileCard from './FileCard';

export default function SharedFiles() {
    const [sharedFiles, setSharedFiles] = useState([]);
    const { currentUser } = useAuth();

    function fetchSharedFiles() {
        const files = getSharedFiles(currentUser.email);
        setSharedFiles(files);
    }

    useEffect(() => {
        if (currentUser) {
            fetchSharedFiles();
        }
    }, [currentUser]);



    return (
        <div className="container">
            <h2 className="mb-4">Files Shared With Me</h2>

            <div className="row">
                {sharedFiles.length > 0 ? (
                    sharedFiles.map(file => (
                        <div className="col-md-4 mb-3" key={file.id}>
                            <FileCard
                                file={file}
                                isOwner={false}
                            />
                        </div>
                    ))
                ) : (
                    <div className="col-12">
                        <div className="alert alert-info">
                            No files have been shared with you yet.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
} 