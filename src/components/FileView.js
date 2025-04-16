import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFileById } from '../services/localDataService';
import { useAuth } from '../contexts/AuthContext';

export default function FileView() {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const { fileId } = useParams();
    const { currentUser } = useAuth();
    const navigate = useNavigate();

    // For carousel functionality
    const [selectedFileIndex, setSelectedFileIndex] = useState(null);
    const [mediaFiles, setMediaFiles] = useState([]);
    const [showCarousel, setShowCarousel] = useState(false);
    const [loadingMedia, setLoadingMedia] = useState(false);
    const [currentMediaFile, setCurrentMediaFile] = useState(null);

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

    useEffect(() => {
        function fetchFile() {
            try {
                const fileData = getFileById(fileId);

                if (fileData) {
                    // Check if user has access to this file
                    const isOwner = fileData.ownerId === currentUser.uid;
                    const isSharedWithUser = fileData.sharedWith && fileData.sharedWith.includes(currentUser.email);

                    if (isOwner || isSharedWithUser) {
                        // If this is a folder, try to get the actual directory handle from window
                        if (fileData.isFolder && window.folderHandles) {
                            const actualHandle = window.folderHandles.get(fileData.id);
                            if (actualHandle) {
                                fileData.directoryHandle = actualHandle;
                            }
                        }

                        setFile(fileData);
                    } else {
                        setError("You don't have permission to view this file");
                        setTimeout(() => navigate('/'), 3000);
                    }
                } else {
                    setError("File not found");
                    setTimeout(() => navigate('/'), 3000);
                }
            } catch (error) {
                setError("Error loading file: " + error.message);
            } finally {
                setLoading(false);
            }
        }

        if (currentUser) {
            fetchFile();
        }
    }, [fileId, currentUser, navigate]);

    // Function to handle resharing a folder
    async function handleReshareFolder() {
        if (!file || !file.isFolder) return;

        try {
            // Show folder picker
            const dirHandle = await window.showDirectoryPicker({
                // Try to start in the same folder by suggesting the folder name
                startIn: 'documents',
                id: file.id,
                mode: 'readwrite'
            });

            // Update the folder handle in memory
            if (!window.folderHandles) {
                window.folderHandles = new Map();
            }
            window.folderHandles.set(file.id, dirHandle);

            // Update the file object
            const updatedFile = { ...file, directoryHandle: dirHandle };
            setFile(updatedFile);

            // Show success message
            alert("Folder access restored successfully!");
        } catch (error) {
            console.error("Error resharing folder:", error);
            if (error.name !== 'AbortError') { // Don't show error if user cancelled
                alert("Error resharing folder: " + error.message);
            }
        }
    }

    function renderFilePreview() {
        if (!file) return null;

        if (file.isFolder) {
            return (
                <div className="folder-view">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <h4>Folder Contents</h4>
                        {!file.directoryHandle && (
                            <button
                                className="btn btn-primary"
                                onClick={handleReshareFolder}
                                title="Restore access to this folder"
                            >
                                Share Again
                            </button>
                        )}
                    </div>

                    {file.directoryHandle ? (
                        <FolderContents
                            directoryHandle={file.directoryHandle}
                            onFileSelect={handleFileSelect}
                            getMimeTypeFromExtension={getMimeTypeFromExtension}
                        />
                    ) : (
                        <StoredFolderContents
                            folderContents={file.folderContents}
                            onReshare={handleReshareFolder}
                        />
                    )}
                </div>
            );
        } else if (file.type.startsWith('image/')) {
            return <img src={file.url} alt={file.name} className="img-fluid" />;
        } else if (file.type.startsWith('video/')) {
            return (
                <video controls className="w-100">
                    <source src={file.url} type={file.type} />
                    Your browser does not support the video tag.
                </video>
            );
        } else if (file.type.startsWith('audio/')) {
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
                    <p>This file type cannot be previewed in the browser.</p>
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

// Component to display stored folder contents
function StoredFolderContents({ folderContents, onReshare }) {
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    if (!folderContents || folderContents.length === 0) {
        return (
            <div>
                <p>This folder is empty or its contents couldn't be loaded.</p>
                <div className="alert alert-warning">
                    <p>You need to share this folder again to access its contents.</p>
                </div>
            </div>
        );
    }

    // Group contents by directory
    const contentsByPath = {};
    folderContents.forEach(item => {
        const pathParts = item.path.split('/');
        const directPath = pathParts.length === 1 ? '' : pathParts.slice(0, -1).join('/');

        if (!contentsByPath[directPath]) {
            contentsByPath[directPath] = [];
        }
        contentsByPath[directPath].push(item);
    });

    // Get root level items
    const rootItems = contentsByPath[''] || [];

    // Get current page items
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = rootItems.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(rootItems.length / itemsPerPage);

    // Change page
    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    return (
        <div>
            <div className="alert alert-warning mb-3">
                <p className="mb-2">
                    <strong>Note:</strong> This is a stored view of the folder contents.
                    To access the actual files, you need to share the folder again.
                </p>
            </div>

            {rootItems.length > itemsPerPage && (
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <div>
                        <small className="text-muted">
                            Showing {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, rootItems.length)} of {rootItems.length} items
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
                {currentItems.map((item, index) => (
                    <div
                        key={index}
                        className="list-group-item"
                    >
                        {item.isDirectory ? '📁' :
                            item.name.match(/\.(jpg|jpeg|png|gif)$/i) ? '🖼️' :
                                item.name.match(/\.(mp4|webm|mov)$/i) ? '🎬' :
                                    item.name.match(/\.(mp3|wav|ogg)$/i) ? '🎵' :
                                        item.name.match(/\.(pdf)$/i) ? '📄' : '📄'} {item.name}

                        {item.isFile && (
                            <span className="text-muted ms-2">
                                ({(item.size / 1024).toFixed(2)} KB)
                            </span>
                        )}
                    </div>
                ))}
            </div>

            {rootItems.length > itemsPerPage && (
                <div className="d-flex justify-content-center mt-3">
                    <nav aria-label="Folder pagination">
                        <ul className="pagination pagination-sm">
                            <li className="page-item disabled">
                                <span className="page-link">
                                    Page {currentPage} of {totalPages}
                                </span>
                            </li>
                        </ul>
                    </nav>
                </div>
            )}
        </div>
    );
} 