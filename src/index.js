import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import 'bootstrap/dist/css/bootstrap.min.css';
import { initFolderHandlesDB } from './utils/folderPersistence';

// Initialize folder persistence system
if ('showDirectoryPicker' in window) {
    // This browser supports the File System Access API
    window.folderHandles = new Map();

    // Initialize the database for folder handles
    initFolderHandlesDB()
        .then(success => {
            if (success) {
                console.log('Folder persistence system initialized successfully');
            } else {
                console.warn('Folder persistence system initialized with warnings');
            }
        })
        .catch(error => {
            console.error('Failed to initialize folder persistence system:', error);
        });

    console.log('This browser supports folder sharing via File System Access API');
} else {
    console.warn('This browser does not support folder sharing via File System Access API');
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);