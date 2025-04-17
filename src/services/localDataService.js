const API_BASE = '/api';  // This will be proxied to http://localhost:3001/api

// User methods
export const getUsers = async () => {
    const response = await fetch(`${API_BASE}/users`);
    if (!response.ok) throw new Error('Failed to fetch users');
    return response.json();
};

export const findUserByEmail = async (email) => {
    const users = await getUsers();
    return users.find(user => user.email === email);
};

export const createUser = async (email, password) => {
    const response = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, createdAt: new Date().toISOString() })
    });
    if (!response.ok) throw new Error('Failed to create user');
    return response.json();
};

// File methods
export const getFiles = async () => {
    const response = await fetch(`${API_BASE}/files`);
    if (!response.ok) throw new Error('Failed to fetch files');
    return response.json();
};

export const addFile = async (fileData) => {
    try {
        // Handle folders differently than regular files
        if (fileData.isFolder) {
            // For folders, don't upload files but just save metadata
            const response = await fetch(`${API_BASE}/files`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fileData)
            });

            if (!response.ok) {
                throw new Error('Failed to share folder');
            }

            return response.json();
        } else {
            // Regular file upload logic
            const formData = new FormData();
            formData.append('file', fileData.file);

            // Add other metadata
            const metadata = {
                ownerId: fileData.ownerId,
                ownerEmail: fileData.ownerEmail,
                sharedWith: fileData.sharedWith || [],
                allowDownload: fileData.allowDownload || false,
            };

            formData.append('metadata', JSON.stringify(metadata));

            const response = await fetch(`${API_BASE}/files`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Failed to upload file');
            }

            const result = await response.json();

            // Fix URL to be absolute for blob URLs and relative URLs
            if (result.url && !result.url.startsWith('http') && !result.url.startsWith('blob:')) {
                result.url = window.location.origin + result.url;
            }

            return result;
        }
    } catch (error) {
        throw error;
    }
};

export const updateFile = async (fileId, updates) => {
    const response = await fetch(`${API_BASE}/files/${fileId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
    });
    if (!response.ok) throw new Error('Failed to update file');
    return response.json();
};

export const deleteFile = async (fileId) => {
    const response = await fetch(`${API_BASE}/files/${fileId}`, {
        method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete file');
    return response.json();
};

export const getUserFiles = async (userId) => {
    const files = await getFiles();
    return files.filter(file => file.ownerId === userId);
};

export const getSharedFiles = async (userEmail) => {
    try {
        const files = await getFiles();
        return files.filter(file => {
            return file.sharedWith &&
                Array.isArray(file.sharedWith) &&
                file.sharedWith.includes(userEmail);
        });
    } catch (error) {
        throw error;
    }
};

export const getFileById = async (fileId) => {
    try {
        const response = await fetch(`${API_BASE}/files/${fileId}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch file: ${response.statusText}`);
        }
        const data = await response.json();

        // Fix URL to be absolute for relative URLs
        if (data.url && !data.url.startsWith('http') && !data.url.startsWith('blob:')) {
            data.url = window.location.origin + data.url;
        }

        return data;
    } catch (error) {
        throw error;
    }
};

// Mark a folder as connected
export const markFolderConnected = async (folderId, userId) => {
    try {
        const response = await fetch(`${API_BASE}/files/${folderId}/connect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });

        if (!response.ok) {
            let errorMsg;
            try {
                const errorData = await response.json();
                errorMsg = errorData.error || response.statusText;
            } catch (e) {
                errorMsg = await response.text() || response.statusText;
            }

            return {
                success: false,
                error: `Server error (${response.status}): ${errorMsg}`
            };
        }

        // Parse the response
        const result = await response.json();
        return { success: true, data: result };
    } catch (error) {
        return { success: false, error: error.message };
    }
};