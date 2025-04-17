/**
 * Folder persistence utilities using IndexedDB
 */

const DB_NAME = "FolderHandlesDB";
const STORE_NAME = "folderHandles";
const DB_VERSION = 1;

let db = null;

// Initialize the database
export async function initFolderHandlesDB() {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject(new Error("IndexedDB not supported"));
            return;
        }

        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            db = event.target.result;

            // Initialize in-memory map
            if (!window.folderHandles) {
                window.folderHandles = new Map();
            }

            // Load all stored handles into memory
            loadAllFolderHandles()
                .then(() => resolve(true))
                .catch(() => resolve(false)); // Continue anyway
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "id" });
            }
        };
    });
}

// Load all folder handles into memory on startup
async function loadAllFolderHandles() {
    if (!db) return Promise.reject("Database not initialized");

    return new Promise((resolve, reject) => {
        try {
            const transaction = db.transaction(STORE_NAME, "readonly");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                const handles = request.result;
                resolve(handles.length);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        } catch (err) {
            reject(err);
        }
    });
}

// Save folder reference to IndexedDB
export async function storeFolderReference(folderId, folderName, ownerId) {
    if (!db) {
        try {
            await initFolderHandlesDB();
        } catch (error) {
            return false;
        }
    }

    return new Promise((resolve, reject) => {
        try {
            const transaction = db.transaction(STORE_NAME, "readwrite");
            const store = transaction.objectStore(STORE_NAME);

            const folderReference = {
                id: folderId,
                folderName,
                ownerId,
                timestamp: Date.now()
            };

            const request = store.put(folderReference);

            request.onsuccess = () => {
                resolve(true);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        } catch (err) {
            reject(err);
        }
    });
}

// Store active folder handle in memory (for current session)
export function storeFolderHandle(folderId, directoryHandle) {
    try {
        if (!window.folderHandles) {
            window.folderHandles = new Map();
        }

        window.folderHandles.set(folderId, directoryHandle);

        // Also store a serializable reference in localStorage as a backup
        localStorage.setItem(`folder_marker_${folderId}`, JSON.stringify({
            id: folderId,
            name: directoryHandle.name,
            timestamp: Date.now()
        }));

        return true;
    } catch (error) {
        return false;
    }
}

// Get folder handle from memory or request access again
export async function getFolderHandle(folderId, folderName) {
    // Check if we already have it in memory
    if (window.folderHandles && window.folderHandles.has(folderId)) {
        return window.folderHandles.get(folderId);
    }

    // We need to ask the user to grant access again
    try {
        const dirHandle = await window.showDirectoryPicker({
            id: folderId, // This helps browsers recognize the same folder
            startIn: 'documents'
        });

        // Store it for this session
        if (!window.folderHandles) window.folderHandles = new Map();
        window.folderHandles.set(folderId, dirHandle);

        return dirHandle;
    } catch (error) {
        throw error;
    }
}

// Check if we have a reference to this folder
export async function hasFolderReference(folderId) {
    if (!db) {
        try {
            await initFolderHandlesDB();
        } catch (error) {
            return false;
        }
    }

    return new Promise((resolve) => {
        try {
            const transaction = db.transaction(STORE_NAME, "readonly");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(folderId);

            request.onsuccess = () => {
                resolve(!!request.result);
            };

            request.onerror = () => {
                resolve(false);
            };
        } catch (err) {
            resolve(false);
        }
    });
}

// Add function to check if a folder is currently connected by its owner
export async function isFolderConnected(fileData) {
    if (!fileData || !fileData.id) return false;

    // First check if we have the directory handle in memory and it's valid
    if (window.folderHandles && window.folderHandles.has(fileData.id)) {
        try {
            const dirHandle = window.folderHandles.get(fileData.id);
            // Try to read at least one entry to verify access
            const entries = dirHandle.values();
            await entries.next();
            // If we got here, the folder is accessible
            return true;
        } catch (error) {
            // Handle is no longer valid
            return false;
        }
    }

    // If we don't have a handle, check if the folder is marked as connected in server data
    // and it was connected recently
    if (fileData.isConnected && fileData.lastConnected) {
        const lastConnectedTime = new Date(fileData.lastConnected).getTime();
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);

        // If connected within the last 5 minutes, we consider it "currently connected"
        return lastConnectedTime > fiveMinutesAgo;
    }

    return false;
}

