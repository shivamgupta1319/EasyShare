import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUserFiles, addFile, updateFile, deleteFile } from '../services/localDataService';
import FileCard from './FileCard';

export default function Dashboard() {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [userFiles, setUserFiles] = useState([]);
    const { currentUser } = useAuth();

    // Use useCallback to memoize the fetchUserFiles function
    const fetchUserFiles = useCallback(() => {
        if (currentUser) {
            const files = getUserFiles(currentUser.uid);
            setUserFiles(files);
        }
    }, [currentUser]);

    useEffect(() => {
        fetchUserFiles();
    }, [fetchUserFiles]);

    function handleFileChange(e) {
        if (e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    }

    async function scanFolderContents(dirHandle, folderPath = '') {
        const folderContents = [];

        try {
            for await (const entry of dirHandle.values()) {
                const entryPath = folderPath ? `${folderPath}/${entry.name}` : entry.name;

                if (entry.kind === 'file') {
                    try {
                        const file = await entry.getFile();
                        folderContents.push({
                            name: entry.name,
                            path: entryPath,
                            type: file.type || 'application/octet-stream',
                            size: file.size,
                            lastModified: file.lastModified,
                            isFile: true
                        });
                    } catch (error) {
                        // Skip error logging for cleaner console
                    }
                } else if (entry.kind === 'directory') {
                    // Add the directory itself
                    folderContents.push({
                        name: entry.name,
                        path: entryPath,
                        isDirectory: true
                    });

                    // Recursively scan subdirectories
                    try {
                        const subContents = await scanFolderContents(entry, entryPath);
                        folderContents.push(...subContents);
                    } catch (error) {
                        // Skip error logging for cleaner console
                    }
                }
            }
        } catch (error) {
            // Skip error logging for cleaner console
        }

        return folderContents;
    }

    async function handleSelectFolder() {
        // Check if the File System Access API is supported
        if ('showDirectoryPicker' in window) {
            try {
                // Show folder picker
                const dirHandle = await window.showDirectoryPicker();
                setScanning(true);

                // Get folder name
                const folderName = dirHandle.name;

                // Scan folder contents
                const folderContents = await scanFolderContents(dirHandle);

                // Store the actual handle in a session-based map
                if (!window.folderHandles) {
                    window.folderHandles = new Map();
                }

                // We need to store a reference to the directory handle
                // but we can't serialize the full object with its methods
                // So we'll store the scanned contents instead
                const newFolder = addFile({
                    name: folderName,
                    type: 'folder',
                    size: 0,
                    isFolder: true,
                    folderContents: folderContents,
                    ownerId: currentUser.uid,
                    ownerEmail: currentUser.email,
                    sharedWith: [],
                    allowDownload: false
                });

                // Store the actual handle for this session
                window.folderHandles.set(newFolder.id, dirHandle);

                fetchUserFiles();
                setScanning(false);
            } catch (error) {
                setScanning(false);

                if (error.name !== 'AbortError') { // Don't show error if user cancelled
                    alert("Error selecting folder: " + error.message);
                }
            }
        } else {
            alert("Your browser doesn't support the File System Access API. Try using Chrome, Edge, or another Chromium-based browser.");
        }
    }

    async function handleUpload() {
        if (!file) return;

        setUploading(true);
        try {
            // Create a URL for the file
            const fileUrl = URL.createObjectURL(file);

            // In a real app, you would upload the file to a server
            // Here we're just storing the file metadata
            addFile({
                name: file.name,
                type: file.type,
                size: file.size,
                url: fileUrl, // In a real app, this would be the server URL
                ownerId: currentUser.uid,
                ownerEmail: currentUser.email,
                sharedWith: [],
                allowDownload: false
            });

            setFile(null);
            fetchUserFiles();
        } catch (error) {
            // Skip error logging for cleaner console
        } finally {
            setUploading(false);
        }
    }

    function toggleDownloadPermission(fileId, currentPermission) {
        try {
            updateFile(fileId, {
                allowDownload: !currentPermission
            });
            fetchUserFiles();
        } catch (error) {
            // Skip error logging for cleaner console
        }
    }

    function shareFile(fileId, email) {
        if (!email) return;

        try {
            const file = userFiles.find(f => f.id === fileId);
            if (!file) return;

            const currentSharedWith = file.sharedWith || [];

            if (!currentSharedWith.includes(email)) {
                updateFile(fileId, {
                    sharedWith: [...currentSharedWith, email]
                });
            }

            fetchUserFiles();
        } catch (error) {
            // Skip error logging for cleaner console
        }
    }

    function handleDeleteFile(fileId) {
        try {
            deleteFile(fileId);
            fetchUserFiles();
        } catch (error) {
            // Skip error logging for cleaner console
        }
    }

    return (
        <div className="container">
            <h2 className="mb-4">My Files</h2>

            <div className="card mb-4">
                <div className="card-body">
                    <h3 className="card-title">Upload a File</h3>
                    <div className="mb-3">
                        <input
                            type="file"
                            className="form-control"
                            onChange={handleFileChange}
                            disabled={uploading}
                        />
                    </div>
                    <button
                        className="btn btn-primary"
                        onClick={handleUpload}
                        disabled={!file || uploading}
                    >
                        {uploading ? 'Uploading...' : 'Upload'}
                    </button>
                </div>
            </div>

            <div className="card mb-4">
                <div className="card-body">
                    <h3 className="card-title">Share a Local Folder</h3>
                    <p className="text-muted">
                        Note: This feature requires a modern browser that supports the File System Access API.
                    </p>
                    <button
                        className="btn btn-primary"
                        onClick={handleSelectFolder}
                        disabled={scanning}
                    >
                        {scanning ? 'Scanning folder...' : 'Select Folder to Share'}
                    </button>
                </div>
            </div>

            <h3 className="mb-3">Your Files</h3>
            <div className="row">
                {userFiles.length > 0 ? (
                    userFiles.map(file => (
                        <div className="col-md-4 mb-3" key={file.id}>
                            <FileCard
                                file={file}
                                isOwner={true}
                                onToggleDownload={() => toggleDownloadPermission(file.id, file.allowDownload)}
                                onShare={(email) => shareFile(file.id, email)}
                                onDelete={() => handleDeleteFile(file.id)}
                            />
                        </div>
                    ))
                ) : (
                    <div className="col-12">
                        <div className="alert alert-info">
                            You haven't uploaded any files yet.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
} 