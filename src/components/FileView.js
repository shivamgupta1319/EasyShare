/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFileById, markFolderConnected, updateFile } from '../services/localDataService';
import { useAuth } from '../contexts/AuthContext';
import { getFolderHandle, hasFolderReference, isFolderConnected } from '../utils/folderPersistence';

export default function FileView() {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const { fileId } = useParams();
    const { currentUser } = useAuth();
    const navigate = useNavigate();

    // For shared folders polling
    const [pollingEnabled, setPollingEnabled] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('unknown');

    // For carousel functionality
    const [selectedFileIndex, setSelectedFileIndex] = useState(null);
    const [mediaFiles, setMediaFiles] = useState([]);
    const [showCarousel, setShowCarousel] = useState(false);
    const [loadingMedia, setLoadingMedia] = useState(false);
    const [currentMediaFile, setCurrentMediaFile] = useState(null);

    // Add notification state
    const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });

    // Function to get MIME type from file extension
    function getMimeTypeFromExtension(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const mimeTypes = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'mp4': 'video/mp4',
            'webm': 'video/webm',
            'mov': 'video/quicktime',
            'mp3': 'audio/mpeg',
            'wav': 'audio/wav',
            'ogg': 'audio/ogg',
            'pdf': 'application/pdf',
            'txt': 'text/plain',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls': 'application/vnd.ms-excel',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'ppt': 'application/vnd.ms-powerpoint',
            'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }

    // Function to handle resharing a folder - update to handle new return format
    async function handleReshareFolder() {
        if (!file || !file.isFolder) return;

        try {
            setLoading(true);

            // Get access to the folder again
            const dirHandle = await getFolderHandle(file.id, file.name);

            // Ensure folderHandles exists in window object
            if (!window.folderHandles) {
                window.folderHandles = new Map();
            }

            // Save the directory handle in memory for this session
            window.folderHandles.set(file.id, dirHandle);

            // Create a basic structure from the directory handle
            const folderStructure = await scanFolderStructure(dirHandle);

            // Update the server to mark this folder as connected
            if (file.ownerId === currentUser.uid) {
                await markFolderConnected(file.id, currentUser.uid);
            }

            // Update the file object in view with the directory handle and structure
            const updatedFile = {
                ...file,
                directoryHandle: dirHandle,
                isConnected: true,
                lastConnected: new Date().toISOString(),
                structure: folderStructure
            };
            await updateFile(file.id, updatedFile);
            setFile(updatedFile);

            // Set connection status to connected
            setConnectionStatus('connected');

            // Use notification instead of alert
            setNotification({
                show: true,
                message: 'Folder access reconnected successfully!',
                type: 'success'
            });

            // Auto-hide notification after 3 seconds
            setTimeout(() => {
                setNotification({ show: false, message: '', type: 'success' });
            }, 3000);

        } catch (error) {
            if (error.name !== 'AbortError') {
                setNotification({
                    show: true,
                    message: `Error reconnecting folder: ${error.message}`,
                    type: 'danger'
                });

                setTimeout(() => {
                    setNotification({ show: false, message: '', type: 'danger' });
                }, 3000);
            }
        } finally {
            setLoading(false);
        }
    }

    // Helper function to scan folder structure
    async function scanFolderStructure(dirHandle, maxDepth = 2, currentDepth = 0) {
        if (!dirHandle || currentDepth > maxDepth) return null;

        try {
            const result = {
                name: dirHandle.name,
                kind: 'directory',
                children: []
            };

            // Limit scan depth to avoid performance issues with large folders
            if (currentDepth >= maxDepth) {
                result.children.push({
                    name: '(More items not shown)',
                    kind: 'limit'
                });
                return result;
            }

            // Scan the directory for files and folders
            let itemCount = 0;
            for await (const entry of dirHandle.values()) {
                if (itemCount >= 50) {
                    // Limit number of items to avoid performance issues
                    result.children.push({
                        name: '(More items not shown)',
                        kind: 'limit'
                    });
                    break;
                }

                if (entry.kind === 'file') {
                    result.children.push({
                        name: entry.name,
                        kind: 'file'
                    });
                } else if (entry.kind === 'directory') {
                    // For directories, recursively scan if not too deep
                    if (currentDepth < maxDepth) {
                        const subDir = await scanFolderStructure(entry, maxDepth, currentDepth + 1);
                        result.children.push(subDir);
                    } else {
                        result.children.push({
                            name: entry.name,
                            kind: 'directory',
                            children: [{
                                name: '(Subfolder contents not shown)',
                                kind: 'placeholder'
                            }]
                        });
                    }
                }
                itemCount++;
            }

            return result;
        } catch (error) {
            return {
                name: dirHandle.name,
                kind: 'directory',
                error: error.message
            };
        }
    }

    async function fetchFile() {
        if (!currentUser || !fileId) return;

        try {
            setLoading(true);
            setError('');

            const fileData = await getFileById(fileId);
            console.log('Fetched file data:', fileData);

            if (!fileData) {
                throw new Error('File not found');
            }

            // Check if user has access to this file
            const isOwner = fileData.ownerId === currentUser.uid;
            const isSharedWithUser = fileData.sharedWith && fileData.sharedWith.includes(currentUser.email);

            if (!isOwner && !isSharedWithUser) {
                throw new Error('You don\'t have permission to view this file');
            }

            // Make sure URLs are properly formed 
            if (fileData.url && !fileData.url.startsWith('http') && !fileData.url.startsWith('blob:') && !fileData.isFolder) {
                // Fix relative URLs to absolute
                fileData.url = window.location.origin + fileData.url;
            }

            // For folders, try to retrieve the directory handle
            if (fileData.isFolder) {
                // Check if we already have the handle in memory
                if (window.folderHandles && window.folderHandles.has(fileData.id)) {
                    fileData.directoryHandle = window.folderHandles.get(fileData.id);
                    console.log('Using folder handle from current session');
                } else if (await hasFolderReference(fileData.id)) {
                    // We know about this folder but need to request access again
                    if (isOwner) {
                        // For owners, set a flag to prompt to reconnect
                        fileData.needsReconnect = true;
                        console.log('Owner needs to reconnect to folder');
                    } else {
                        // For users who folder was shared with
                        console.log('Non-owner accessing shared folder');
                        setPollingEnabled(true); // Start polling since we're a guest
                    }
                }

                // Check connection status
                const connected = await isFolderConnected(fileData);
                setConnectionStatus(connected ? 'connected' : 'disconnected');
            }

            setFile(fileData);


        } catch (error) {
            console.error('Error loading file:', error);
            setError(error.message);
            setLoading(false);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchFile();
    }, [fileId, currentUser]);

    // Add polling for shared folders
    useEffect(() => {
        // Only poll if we're looking at a shared folder we don't own
        if (!file || !file.isFolder || !pollingEnabled) return;

        // Don't poll if we're the owner
        const isOwner = file.ownerId === currentUser?.uid;
        if (isOwner) return;

        console.log("Starting polling for folder connection status");

        const checkConnectionStatus = async () => {
            try {
                // Re-fetch file data to check its connection status
                const freshFileData = await getFileById(fileId);

                // If the owner has marked it as connected recently
                if (freshFileData.isConnected &&
                    freshFileData.connectedBy === freshFileData.ownerId &&
                    freshFileData.lastConnected) {

                    const lastConnectedTime = new Date(freshFileData.lastConnected).getTime();
                    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);

                    if (lastConnectedTime > fiveMinutesAgo) {
                        setConnectionStatus('connected');
                        setFile(freshFileData); // Update with latest data
                        console.log('Owner has this folder connected');
                    } else {
                        setConnectionStatus('disconnected');
                        console.log('Owner connection is stale (>5min old)');
                    }
                } else {
                    setConnectionStatus('disconnected');
                    console.log('Folder is not currently connected by owner');
                }
            } catch (error) {
                console.error("Error checking folder connection:", error);
            }
        };

        // Check immediately
        checkConnectionStatus();

        // Set up polling every 10 seconds
        const intervalId = setInterval(checkConnectionStatus, 10000);

        // Cleanup interval on unmount
        return () => {
            clearInterval(intervalId);
            console.log("Stopped polling for folder connection status");
        };
    }, [file, fileId, currentUser, pollingEnabled]);

    function renderFilePreview() {
        if (!file) return null;

        if (file.isFolder) {
            const isOwner = file.ownerId === currentUser.uid;

            // If we're dealing with a shared folder and we're not the owner
            if (!isOwner) {
                const isConnected = connectionStatus === 'connected' || file.isConnected;

                return (
                    <div className="folder-view">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <h4>Folder Contents</h4>
                        </div>

                        {isConnected ? (
                            <div className="alert alert-success">
                                <p><strong>Connection active:</strong> The folder owner has this folder open.</p>
                                {file.structure && (
                                    <FolderStructureView
                                        structure={file.structure}
                                        onReshare={null}
                                        isOwner={false}
                                        isConnected={true}
                                    />
                                )}
                            </div>
                        ) : (
                            <div className="alert alert-warning">
                                <p>This folder needs to be reconnected by its owner to view contents.</p>
                                <p>Please ask <strong>{file.ownerEmail}</strong> to open this folder.</p>
                                <p className="mb-1">Checking connection status...</p>
                                <div className="progress mt-2">
                                    <div className="progress-bar progress-bar-striped progress-bar-animated"
                                        role="progressbar"
                                        style={{ width: "100%" }}></div>
                                </div>

                                {file.structure && (
                                    <div className="mt-3">
                                        <p>Folder structure preview:</p>
                                        <FolderStructureView
                                            structure={file.structure}
                                            onReshare={null}
                                            isOwner={false}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            }

            // Normal owner view
            return (
                <div className="folder-view">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <h4>Folder Contents</h4>
                    </div>

                    {file.directoryHandle ? (
                        <>
                            {file.sharedWith && file.sharedWith.length > 0 && (
                                <div className="alert alert-info mb-3">
                                    <strong>Note:</strong> You are sharing this folder. While you keep this folder open,
                                    other users can browse its contents.
                                </div>
                            )}
                            <FolderContents
                                directoryHandle={file.directoryHandle}
                                onFileSelect={handleFileSelect}
                                getMimeTypeFromExtension={getMimeTypeFromExtension}
                            />
                        </>
                    ) : file.structure ? (
                        <FolderStructureView
                            structure={file.structure}
                            onReshare={handleReshareFolder}
                            isOwner={isOwner}
                        />
                    ) : (
                        <div className="alert alert-warning">
                            <p>This folder needs to be reconnected to view its contents.</p>
                            <button className="btn btn-primary mt-2" onClick={handleReshareFolder}>
                                Reconnect Folder
                            </button>
                        </div>
                    )}
                </div>
            );
        } else if (file.type?.startsWith('image/')) {
            return (
                <div className="text-center">
                    {file.url ? (
                        <img
                            src={file.url}
                            alt={file.name}
                            className="img-fluid"
                            onError={(e) => {
                                console.error('Image loading error:', e);
                                setError(`Failed to load image: ${file.url}`);
                            }}
                        />
                    ) : (
                        <div className="alert alert-warning">Image URL is missing</div>
                    )}
                </div>
            );
        } else if (file.type?.startsWith('video/')) {
            return (
                <div className="text-center">
                    {file.url ? (
                        <video controls className="w-100">
                            <source src={file.url} type={file.type} />
                            Your browser does not support the video tag.
                        </video>
                    ) : (
                        <div className="alert alert-warning">Video URL is missing</div>
                    )}
                </div>
            );
        } else if (file.type?.startsWith('audio/')) {
            return (
                <audio controls className="w-100">
                    <source src={file.url} type={file.type} />
                    Your browser does not support the audio tag.
                </audio>
            );
        } else if (file.type === 'application/pdf') {
            return (
                <iframe
                    src={file.url}
                    title={file.name}
                    width="100%"
                    height="600px"
                    className="border-0"
                ></iframe>
            );
        } else {
            return (
                <div className="text-center p-5 bg-light">
                    <h3>Preview not available</h3>
                    <p>This file type ({file.type || 'unknown'}) cannot be previewed in the browser.</p>
                    {file.url && (
                        <a href={file.url} className="btn btn-primary" target="_blank" rel="noopener noreferrer">
                            Open File
                        </a>
                    )}
                </div>
            );
        }
    }

    // Function to handle file selection from folder
    async function handleFileSelect(fileData, index, mediaFilesList) {
        console.log("File selected in main component:", fileData);
        setLoadingMedia(true);

        try {
            // Store the full media files list with their handles
            setMediaFiles(mediaFilesList);

            // Set the current file and index
            setCurrentMediaFile(fileData);
            setSelectedFileIndex(index);

            // Show the carousel
            setShowCarousel(true);
        } catch (error) {
            console.error("Error loading media:", error);
        } finally {
            setLoadingMedia(false);
        }
    }

    // Carousel navigation functions
    async function goToPrevious() {
        if (!mediaFiles.length) return;

        setLoadingMedia(true);

        try {
            let newIndex;
            if (selectedFileIndex > 0) {
                newIndex = selectedFileIndex - 1;
            } else {
                // Loop to the end
                newIndex = mediaFiles.length - 1;
            }

            // Get the file at the new index
            const prevFile = mediaFiles[newIndex];

            // If we don't have the file data loaded yet, load it
            if (!prevFile.url) {
                const fileHandle = prevFile.handle;
                if (fileHandle) {
                    const file = await fileHandle.getFile();
                    prevFile.url = URL.createObjectURL(file);
                    prevFile.type = file.type || getMimeTypeFromExtension(file.name);
                    prevFile.size = file.size;
                }
            }

            // Update the current media file and index
            setCurrentMediaFile(prevFile);
            setSelectedFileIndex(newIndex);
        } catch (error) {
            console.error("Error navigating to previous:", error);
        } finally {
            setLoadingMedia(false);
        }
    }

    async function goToNext() {
        if (!mediaFiles.length) return;

        setLoadingMedia(true);

        try {
            let newIndex;
            if (selectedFileIndex < mediaFiles.length - 1) {
                newIndex = selectedFileIndex + 1;
            } else {
                // Loop to the beginning
                newIndex = 0;
            }

            // Get the file at the new index
            const nextFile = mediaFiles[newIndex];

            // If we don't have the file data loaded yet, load it
            if (!nextFile.url) {
                const fileHandle = nextFile.handle;
                if (fileHandle) {
                    const file = await fileHandle.getFile();
                    nextFile.url = URL.createObjectURL(file);
                    nextFile.type = file.type || getMimeTypeFromExtension(file.name);
                    nextFile.size = file.size;
                }
            }

            // Update the current media file and index
            setCurrentMediaFile(nextFile);
            setSelectedFileIndex(newIndex);
        } catch (error) {
            console.error("Error navigating to next:", error);
        } finally {
            setLoadingMedia(false);
        }
    }

    function closeCarousel() {
        setShowCarousel(false);
        setSelectedFileIndex(null);
        setMediaFiles([]);
        setCurrentMediaFile(null);
    }

    function renderCarousel() {
        if (!showCarousel || !currentMediaFile) return null;

        return (
            <div className="carousel-container">
                <div className="carousel-backdrop" onClick={closeCarousel}></div>
                <div className="carousel-content">
                    <button className="carousel-close" onClick={closeCarousel}>×</button>

                    <div className="carousel-media">
                        {loadingMedia ? (
                            <div className="spinner-border text-light" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                        ) : currentMediaFile.type?.startsWith('image/') ? (
                            <img src={currentMediaFile.url} alt={currentMediaFile.name} />
                        ) : currentMediaFile.type?.startsWith('video/') ? (
                            <video controls autoPlay>
                                <source src={currentMediaFile.url} type={currentMediaFile.type} />
                                Your browser does not support the video tag.
                            </video>
                        ) : (
                            <div className="unsupported-media">
                                <h3>Preview not available</h3>
                                <p>This file type cannot be previewed in the carousel.</p>
                            </div>
                        )}
                    </div>

                    <div className="carousel-caption">
                        {currentMediaFile.name} ({selectedFileIndex + 1}/{mediaFiles.length})
                    </div>

                    <button className="carousel-nav carousel-prev" onClick={goToPrevious}>
                        ‹
                    </button>
                    <button className="carousel-nav carousel-next" onClick={goToNext}>
                        ›
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="container">
            {notification.show && (
                <div className={`alert alert-${notification.type} position-fixed top-0 end-0 m-3`}
                    style={{ zIndex: 1050, maxWidth: '80%', opacity: 0.9 }}>
                    {notification.message}
                </div>
            )}

            <div className="card mb-4">
                <div className="card-body">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <h2 className="card-title">{file?.name}</h2>
                        <button className="btn btn-outline-secondary" onClick={() => navigate(-1)}>
                            Back
                        </button>
                    </div>

                    {file && (
                        <div className="mb-3">
                            <p className="text-muted">
                                {file.isFolder ? 'Folder shared by: ' : 'File shared by: '}
                                {file.ownerEmail}
                            </p>
                        </div>
                    )}

                    {loading ? (
                        <div className="text-center p-5">
                            <div className="spinner-border" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="alert alert-danger">{error}</div>
                    ) : (
                        <div className="file-preview-container">
                            {renderFilePreview()}
                        </div>
                    )}
                </div>
            </div>

            {renderCarousel()}
        </div>
    );
}

// Component to display folder contents
function FolderContents({ directoryHandle, onFileSelect, getMimeTypeFromExtension }) {
    const [contents, setContents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    useEffect(() => {
        async function fetchContents() {
            try {
                const items = [];
                for await (const entry of directoryHandle.values()) {
                    items.push(entry);
                }
                setContents(items);
            } catch (error) {
                console.error("Error reading directory:", error);
                setError("Error reading folder contents: " + error.message);
            } finally {
                setLoading(false);
            }
        }

        fetchContents();
    }, [directoryHandle]);

    // Get current page items
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = contents.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(contents.length / itemsPerPage);

    // Change page
    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    // Function to get file data from a file handle
    async function getFileData(item) {
        try {
            const file = await item.getFile();
            const url = URL.createObjectURL(file);

            return {
                name: file.name,
                type: file.type || getMimeTypeFromExtension(file.name),
                size: file.size,
                url: url,
                handle: item
            };
        } catch (error) {
            console.error("Error getting file data:", error);
            return null;
        }
    }

    // Handle file click
    async function handleFileClick(item, index) {
        if (item.kind === 'file') {
            try {
                console.log("File clicked:", item.name);
                // Get file data
                const fileData = await getFileData(item);

                if (!fileData) {
                    alert("Error opening file");
                    return;
                }

                // Check if this is a media file
                const isMediaFile = fileData.type.startsWith('image/') ||
                    fileData.type.startsWith('video/');

                if (!isMediaFile) {
                    // For non-media files, just open in a new tab
                    window.open(fileData.url, '_blank');
                    return;
                }

                // Get all media files for carousel
                const mediaFiles = [];
                let mediaIndex = 0;

                for (let i = 0; i < contents.length; i++) {
                    const contentItem = contents[i];
                    if (contentItem.kind === 'file') {
                        try {
                            const data = await getFileData(contentItem);
                            if (data && (data.type.startsWith('image/') || data.type.startsWith('video/'))) {
                                mediaFiles.push(data);
                                if (i === index) {
                                    mediaIndex = mediaFiles.length - 1;
                                }
                            }
                        } catch (err) {
                            console.error("Error processing file:", err);
                        }
                    }
                }

                console.log("Media files found:", mediaFiles.length);

                // Call the parent component's handler
                if (mediaFiles.length > 0) {
                    console.log("Calling onFileSelect with:", fileData, mediaIndex, mediaFiles);
                    onFileSelect(fileData, mediaIndex, mediaFiles);
                } else {
                    window.open(fileData.url, '_blank');
                }
            } catch (error) {
                console.error("Error handling file click:", error);
                alert("Error opening file: " + error.message);
            }
        }
    }

    if (loading) return <div>Loading folder contents...</div>;
    if (error) return <div className="alert alert-danger">{error}</div>;

    return (
        <div>
            {contents.length > itemsPerPage && (
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <div>
                        <small className="text-muted">
                            Showing {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, contents.length)} of {contents.length} items
                        </small>
                    </div>
                    <nav aria-label="Folder pagination">
                        <ul className="pagination pagination-sm mb-0">
                            <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                                <button
                                    className="page-link"
                                    onClick={() => paginate(currentPage - 1)}
                                    disabled={currentPage === 1}
                                >
                                    Previous
                                </button>
                            </li>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum;
                                if (totalPages <= 5) {
                                    pageNum = i + 1;
                                } else if (currentPage <= 3) {
                                    pageNum = i + 1;
                                } else if (currentPage >= totalPages - 2) {
                                    pageNum = totalPages - 4 + i;
                                } else {
                                    pageNum = currentPage - 2 + i;
                                }

                                return (
                                    <li key={pageNum} className={`page-item ${currentPage === pageNum ? 'active' : ''}`}>
                                        <button
                                            className="page-link"
                                            onClick={() => paginate(pageNum)}
                                        >
                                            {pageNum}
                                        </button>
                                    </li>
                                );
                            })}
                            <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                                <button
                                    className="page-link"
                                    onClick={() => paginate(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                >
                                    Next
                                </button>
                            </li>
                        </ul>
                    </nav>
                </div>
            )}

            <div className="list-group">
                {contents.length === 0 ? (
                    <p>This folder is empty</p>
                ) : (
                    currentItems.map((item, index) => (
                        <div
                            key={index}
                            className="list-group-item list-group-item-action"
                            onClick={() => handleFileClick(item, indexOfFirstItem + index)}
                            style={{ cursor: item.kind === 'file' ? 'pointer' : 'default' }}
                        >
                            {item.kind === 'directory' ? '📁' :
                                item.name.match(/\.(jpg|jpeg|png|gif)$/i) ? '🖼️' :
                                    item.name.match(/\.(mp4|webm|mov)$/i) ? '🎬' :
                                        item.name.match(/\.(mp3|wav|ogg)$/i) ? '🎵' :
                                            item.name.match(/\.(pdf)$/i) ? '📄' : '📄'} {item.name}
                        </div>
                    ))
                )}
            </div>

            {contents.length > itemsPerPage && (
                <div className="d-flex justify-content-center mt-3">
                    <nav aria-label="Folder pagination">
                        <ul className="pagination pagination-sm">
                            <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                                <button
                                    className="page-link"
                                    onClick={() => paginate(1)}
                                    disabled={currentPage === 1}
                                >
                                    First
                                </button>
                            </li>
                            <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                                <button
                                    className="page-link"
                                    onClick={() => paginate(currentPage - 1)}
                                    disabled={currentPage === 1}
                                >
                                    Previous
                                </button>
                            </li>
                            <li className="page-item disabled">
                                <span className="page-link">
                                    Page {currentPage} of {totalPages}
                                </span>
                            </li>
                            <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                                <button
                                    className="page-link"
                                    onClick={() => paginate(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                >
                                    Next
                                </button>
                            </li>
                            <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                                <button
                                    className="page-link"
                                    onClick={() => paginate(totalPages)}
                                    disabled={currentPage === totalPages}
                                >
                                    Last
                                </button>
                            </li>
                        </ul>
                    </nav>
                </div>
            )}
        </div>
    );
}

// Component to display folder structure
function FolderStructureView({ structure, onReshare, isOwner, isConnected = false }) {
    const [currentPath, setCurrentPath] = useState('/');

    if (!structure) {
        return (
            <div className="alert alert-info">
                <p>No folder structure information is available.</p>
                {isOwner && (
                    <button className="btn btn-primary mt-2" onClick={onReshare}>
                        Reconnect Folder
                    </button>
                )}
            </div>
        );
    }

    // Find items at the current path
    function getItemsAtPath(structure, path) {
        if (path === '/') {
            // At root level, return the immediate children
            return structure.children || [];
        }

        // Otherwise, find the folder at the path
        const pathParts = path.split('/').filter(Boolean);
        let currentFolder = structure;

        for (const part of pathParts) {
            if (!currentFolder.children) return [];

            const nextFolder = currentFolder.children.find(item =>
                item.kind === 'directory' && item.name === part
            );

            if (!nextFolder) return [];
            currentFolder = nextFolder;
        }

        return currentFolder.children || [];
    }

    const items = getItemsAtPath(structure, currentPath);

    // Navigation functions
    function goToParentFolder() {
        if (currentPath === '/') return;

        const pathParts = currentPath.split('/').filter(Boolean);
        pathParts.pop();
        setCurrentPath(pathParts.length === 0 ? '/' : '/' + pathParts.join('/'));
    }

    function navigateToFolder(folderName) {
        setCurrentPath(currentPath === '/' ?
            '/' + folderName :
            currentPath + '/' + folderName
        );
    }

    return (
        <div>
            <div className="mb-3">
                <nav aria-label="breadcrumb">
                    <ol className="breadcrumb">
                        <li
                            className={`breadcrumb-item ${currentPath === '/' ? 'active' : ''}`}
                            onClick={() => setCurrentPath('/')}
                            style={{ cursor: 'pointer' }}
                        >
                            Root
                        </li>

                        {currentPath !== '/' && currentPath.split('/').filter(Boolean).map((part, index, array) => {
                            const path = '/' + array.slice(0, index + 1).join('/');
                            return (
                                <li
                                    key={path}
                                    className={`breadcrumb-item ${index === array.length - 1 ? 'active' : ''}`}
                                    onClick={() => setCurrentPath(path)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    {part}
                                </li>
                            );
                        })}
                    </ol>
                </nav>

                {currentPath !== '/' && (
                    <button
                        className="btn btn-sm btn-outline-secondary mb-3"
                        onClick={goToParentFolder}
                    >
                        ⬆️ Up to parent folder
                    </button>
                )}
            </div>

            <div className={`alert ${isConnected ? 'alert-success' : 'alert-warning'} mb-3`}>
                <p className="mb-0">
                    <strong>Note:</strong> This is a stored view of the folder structure.
                    {isConnected
                        ? ' The folder owner is currently connected.'
                        : ' To access actual files, the folder owner needs to reconnect.'
                    }
                </p>
                {isOwner && onReshare && (
                    <button
                        className="btn btn-primary btn-sm mt-2"
                        onClick={onReshare}
                    >
                        Reconnect Folder
                    </button>
                )}
            </div>

            <div className="list-group">
                {items.length === 0 ? (
                    <p>This folder is empty</p>
                ) : (
                    items.map((item, index) => (
                        <div
                            key={index}
                            className={`list-group-item ${item.kind === 'directory' ? 'list-group-item-action' : ''}`}
                            onClick={() => item.kind === 'directory' && navigateToFolder(item.name)}
                            style={{ cursor: item.kind === 'directory' ? 'pointer' : 'default' }}
                        >
                            {item.kind === 'directory' ? '📁' :
                                item.kind === 'limit' ? '⚠️' :
                                    item.kind === 'placeholder' ? '↪️' :
                                        item.name?.match(/\.(jpg|jpeg|png|gif)$/i) ? '🖼️' :
                                            item.name?.match(/\.(mp4|webm|mov)$/i) ? '🎬' :
                                                item.name?.match(/\.(mp3|wav|ogg)$/i) ? '🎵' :
                                                    item.name?.match(/\.(pdf)$/i) ? '📄' : '📄'} {item.name}
                        </div>
                    ))
                )}
            </div>

            {isOwner && onReshare && (
                <div className="text-center mt-3">
                    <button
                        className="btn btn-primary"
                        onClick={onReshare}
                    >
                        Reconnect Folder to Access Files
                    </button>
                </div>
            )}
        </div>
    );
}