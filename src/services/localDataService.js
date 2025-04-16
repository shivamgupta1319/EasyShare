// This service handles all data operations using localStorage

const LOCAL_STORAGE_USERS_KEY = 'file_sharing_users';
const LOCAL_STORAGE_FILES_KEY = 'file_sharing_files';

// Initialize local storage with default data if empty
const initializeStorage = () => {
    if (!localStorage.getItem(LOCAL_STORAGE_USERS_KEY)) {
        localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify([]));
    }

    if (!localStorage.getItem(LOCAL_STORAGE_FILES_KEY)) {
        localStorage.setItem(LOCAL_STORAGE_FILES_KEY, JSON.stringify([]));
    }
};

// User methods
export const getUsers = () => {
    initializeStorage();
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_USERS_KEY));
};

export const saveUsers = (users) => {
    localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(users));
};

export const findUserByEmail = (email) => {
    const users = getUsers();
    return users.find(user => user.email === email);
};

export const createUser = (email, password) => {
    const users = getUsers();
    const newUser = {
        uid: Date.now().toString(),
        email,
        password, // In a real app, you would hash this password
        createdAt: new Date().toISOString()
    };

    users.push(newUser);
    saveUsers(users);
    return newUser;
};

// File methods
export const getFiles = () => {
    initializeStorage();
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_FILES_KEY));
};

export const saveFiles = (files) => {
    localStorage.setItem(LOCAL_STORAGE_FILES_KEY, JSON.stringify(files));
};

export const addFile = (fileData) => {
    const files = getFiles();
    const newFile = {
        id: Date.now().toString(),
        ...fileData,
        createdAt: new Date().toISOString()
    };

    files.push(newFile);
    saveFiles(files);
    return newFile;
};

export const updateFile = (fileId, updates) => {
    const files = getFiles();
    const fileIndex = files.findIndex(file => file.id === fileId);

    if (fileIndex !== -1) {
        files[fileIndex] = { ...files[fileIndex], ...updates };
        saveFiles(files);
        return files[fileIndex];
    }
    return null;
};

export const deleteFile = (fileId) => {
    const files = getFiles();
    const newFiles = files.filter(file => file.id !== fileId);
    saveFiles(newFiles);
};

export const getUserFiles = (userId) => {
    const files = getFiles();
    return files.filter(file => file.ownerId === userId);
};

export const getSharedFiles = (userEmail) => {
    const files = getFiles();
    return files.filter(file => file.sharedWith && file.sharedWith.includes(userEmail));
};

export const getFileById = (fileId) => {
    const files = getFiles();
    return files.find(file => file.id === fileId);
}; 