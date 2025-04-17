import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { addFile, deleteFile, getUserFiles, updateFile } from '../services/localDataService';
import FileCard from './FileCard';
import { storeFolderReference, storeFolderHandle } from '../utils/folderPersistence';

export default function Dashboard() {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [userFiles, setUserFiles] = useState([]);
    const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
    const { currentUser } = useAuth();

    const fetchUserFiles = useCallback(async () => {
        if (currentUser) {
            try {
                const files = await getUserFiles(currentUser.uid);
                setUserFiles(files);
            } catch (error) {
                showNotification('Error loading files', 'danger');
            }
        }
    }, [currentUser]);

    useEffect(() => {
        fetchUserFiles();
    }, [fetchUserFiles]);

    function showNotification(message, type = 'success') {
        setNotification({ show: true, message, type });
        setTimeout(() => {
            setNotification({ show: false, message: '', type });
        }, 3000);
    }

    function handleFileChange(e) {
        if (e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    }

    async function handleSelectFolder() {
        // Check if the File System Access API is supported
        if (!('showDirectoryPicker' in window)) {
            showNotification("Your browser doesn't support folder sharing. Try Chrome or Edge instead.", 'danger');
            return;
        }

        try {
            // Show folder picker
            const dirHandle = await window.showDirectoryPicker({
                mode: 'readwrite',  // Request read/write permission
                startIn: 'documents'
            });

            setScanning(true);

            // Generate a unique folder ID
            const folderId = `folder_${Date.now()}`;

            // Request persistent access permission
            const permissionState = await dirHandle.requestPermission({ mode: 'readwrite' });

            if (permissionState !== 'granted') {
                throw new Error('Permission to access the folder was denied');
            }

            // Store the folder reference persistently and the handle in memory
            await storeFolderReference(folderId, dirHandle.name, currentUser.uid);
            storeFolderHandle(folderId, dirHandle);

            // Scan folder structure
            const folderStructure = await scanFolderStructure(dirHandle, 2);

            // Create folder metadata without uploading content
            const folderInfo = {
                id: folderId,
                name: dirHandle.name,
                path: '/',
                type: 'folder',
                size: 0,
                isFolder: true,
                ownerId: currentUser.uid,
                ownerEmail: currentUser.email,
                sharedWith: [],
                allowDownload: false,
                createdAt: new Date().toISOString(),
                structure: folderStructure,
                isConnected: true,
                connectedBy: currentUser.uid,
                lastConnected: new Date().toISOString()
            };

            // Save folder metadata to server
            await addFile(folderInfo);

            // Update UI
            await fetchUserFiles();
            showNotification(`Folder "${dirHandle.name}" shared successfully`);

        } catch (error) {
            if (error.name !== 'AbortError') {
                showNotification("Error sharing folder: " + error.message, 'danger');
            }
        } finally {
            setScanning(false);
        }
    }

    // Quick folder structure scan - doesn't read file contents, just structure
    async function scanFolderStructure(dirHandle, depth = 1, path = '') {
        if (depth <= 0) return null;

        const structure = {
            name: dirHandle.name,
            path: path || '/',
            kind: 'directory',
            children: []
        };

        try {
            // Only scan up to 50 items per folder to avoid performance issues
            let count = 0;
            for await (const entry of dirHandle.values()) {
                if (count >= 50) {
                    structure.children.push({ name: "...(more items)", kind: "limit" });
                    break;
                }

                const entryPath = path ? `${path}/${entry.name}` : entry.name;

                if (entry.kind === 'file') {
                    structure.children.push({
                        name: entry.name,
                        path: entryPath,
                        kind: 'file'
                    });
                } else if (entry.kind === 'directory' && depth > 1) {
                    const subStructure = await scanFolderStructure(entry, depth - 1, entryPath);
                    if (subStructure) {
                        structure.children.push(subStructure);
                    }
                } else if (entry.kind === 'directory') {
                    structure.children.push({
                        name: entry.name,
                        path: entryPath,
                        kind: 'directory',
                        children: [{ name: "...(click to explore)", kind: "placeholder" }]
                    });
                }
                count++;
            }
        } catch (error) {
            structure.error = error.message;
        }

        return structure;
    }

    async function handleUpload() {
        if (!file) return;

        setUploading(true);
        try {
            const fileData = {
                file: file,
                ownerId: currentUser.uid,
                ownerEmail: currentUser.email,
                sharedWith: [],
                allowDownload: false
            };

            await addFile(fileData);
            setFile(null);
            showNotification('File uploaded successfully');
        } catch (error) {
            showNotification('Failed to upload file: ' + error.message, 'danger');
        } finally {
            setUploading(false);
            await fetchUserFiles();
        }
    }

    async function toggleDownloadPermission(fileId, currentPermission) {
        try {
            await updateFile(fileId, {
                allowDownload: !currentPermission
            });
            await fetchUserFiles();
        } catch (error) {
            showNotification('Error updating file permissions', 'danger');
        }
    }

    async function shareFile(fileId, email) {
        if (!email) return;

        try {
            // Find file in our local state first
            const file = userFiles.find(f => f.id === fileId);
            if (!file) {
                return;
            }

            // Get current shared users or initialize empty array
            const currentSharedWith = file.sharedWith || [];

            // Don't add if already shared
            if (currentSharedWith.includes(email)) {
                showNotification(`This file is already shared with ${email}`, 'warning');
                return;
            }

            // Update the file
            const updatedSharedWith = [...currentSharedWith, email];

            await updateFile(fileId, {
                sharedWith: updatedSharedWith
            });

            showNotification(`File "${file.name}" shared with ${email}`);
            await fetchUserFiles();
        } catch (error) {
            showNotification(`Error sharing file: ${error.message}`, 'danger');
        }
    }

    async function handleDeleteFile(fileId) {
        try {
            await deleteFile(fileId);
            showNotification('File deleted successfully');
            await fetchUserFiles();
        } catch (error) {
            showNotification('Error deleting file', 'danger');
        }
    }

    return (
        <div className="container">
            {notification.show && (
                <div className={`alert alert-${notification.type} position-fixed top-0 end-0 m-3`}
                    style={{ zIndex: 1050, maxWidth: '80%', opacity: 0.9 }}>
                    {notification.message}
                </div>
            )}

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