const express = require('express');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const multer = require('multer');
const app = express();

app.use(express.json());

const USERS_FILE = path.join(__dirname, '../public/data/users.json');
const FILES_FILE = path.join(__dirname, '../public/data/files.json');
const UPLOAD_DIR = path.join(__dirname, '../public/uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOAD_DIR);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// Ensure data files exist
async function ensureFile(filePath, defaultContent = []) {
    try {
        await fsPromises.access(filePath);
    } catch {
        await fsPromises.writeFile(filePath, JSON.stringify(defaultContent, null, 2));
    }
}

// Make sure uploads directory exists
const ensureUploadsDir = async () => {
    if (!fs.existsSync(UPLOAD_DIR)) {
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    // Create a test file to ensure the directory is writable
    const testFilePath = path.join(UPLOAD_DIR, '.test');
    try {
        await fsPromises.writeFile(testFilePath, 'test');
        await fsPromises.unlink(testFilePath);
    } catch (error) {
        console.error('Upload directory is not writable:', error);
    }
};

// Initialize data files and directories
(async () => {
    await ensureFile(USERS_FILE);
    await ensureFile(FILES_FILE);
    await ensureUploadsDir();
    console.log('Server initialized with data files and upload directory');
})();

// Add this new route before the existing user routes
app.get('/api/users/email/:email', async (req, res) => {
    try {
        const data = await fsPromises.readFile(USERS_FILE, 'utf8');
        const users = JSON.parse(data);
        const user = users.find(u => u.email === req.params.email);
        if (user) {
            res.json(user);
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// User routes
app.get('/api/users', async (req, res) => {
    try {
        const data = await fsPromises.readFile(USERS_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/users', async (req, res) => {
    try {
        const data = await fsPromises.readFile(USERS_FILE, 'utf8');
        const users = JSON.parse(data);
        const newUser = { ...req.body, uid: Date.now().toString() };
        users.push(newUser);
        await fsPromises.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
        res.json(newUser);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// File routes
app.get('/api/files', async (req, res) => {
    try {
        const data = await fsPromises.readFile(FILES_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add this endpoint to get a single file by ID
app.get('/api/files/:id', async (req, res) => {
    try {
        const data = await fsPromises.readFile(FILES_FILE, 'utf8');
        const files = JSON.parse(data);
        const file = files.find(f => f.id === req.params.id);
        if (file) {
            res.json(file);
        } else {
            res.status(404).json({ error: 'File not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Fix the folder connection endpoint
app.post('/api/files/:id/connect', async (req, res) => {
    try {
        // Validation
        if (!req.params.id || !req.body.userId) {
            return res.status(400).json({ error: 'Missing folder ID or user ID' });
        }

        // Ensure data file exists and can be read
        if (!fs.existsSync(FILES_FILE)) {
            await ensureFile(FILES_FILE, []);
        }

        const data = await fsPromises.readFile(FILES_FILE, 'utf8');
        let files;

        try {
            files = JSON.parse(data);
        } catch (parseError) {
            console.error('Error parsing files JSON:', parseError);
            return res.status(500).json({ error: 'Invalid file data format' });
        }

        const index = files.findIndex(f => f.id === req.params.id);

        if (index !== -1) {
            // Update the file's connection status
            files[index] = {
                ...files[index],
                isConnected: true,
                connectedBy: req.body.userId,
                lastConnected: new Date().toISOString()
            };

            // Save updated files
            await fsPromises.writeFile(FILES_FILE, JSON.stringify(files, null, 2));
            return res.json(files[index]);
        } else {
            console.warn(`File with ID ${req.params.id} not found`);
            return res.status(404).json({ error: 'File not found' });
        }
    } catch (error) {
        console.error('Error marking folder as connected:', error);
        return res.status(500).json({ error: error.message || 'Server error' });
    }
});

// Update the files POST endpoint to handle both uploads and folder metadata
app.post('/api/files', upload.single('file'), async (req, res) => {
    try {
        const data = await fsPromises.readFile(FILES_FILE, 'utf8');
        const files = JSON.parse(data);

        let newFile;

        // Check if this is a folder metadata or a file upload
        if (req.file) {
            // File upload case
            let metadata = {};
            try {
                metadata = JSON.parse(req.body.metadata);
            } catch (error) {
                console.error('Error parsing metadata:', error);
                metadata = {};
            }

            const fileUrl = `/uploads/${req.file.filename}`;
            newFile = {
                id: Date.now().toString(),
                name: req.file.originalname,
                type: req.file.mimetype,
                size: req.file.size,
                url: fileUrl,
                ...metadata,
                createdAt: new Date().toISOString()
            };

        } else {
            // Folder metadata case
            newFile = {
                id: req.body.id || Date.now().toString(),
                ...req.body,
                createdAt: new Date().toISOString()
            };
        }

        files.push(newFile);
        await fsPromises.writeFile(FILES_FILE, JSON.stringify(files, null, 2));
        res.json(newFile);
    } catch (error) {
        console.error('Error handling file upload/metadata:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/files/:id', async (req, res) => {
    try {
        const data = await fsPromises.readFile(FILES_FILE, 'utf8');
        const files = JSON.parse(data);
        const index = files.findIndex(f => f.id === req.params.id);
        if (index !== -1) {
            files[index] = { ...files[index], ...req.body };
            await fsPromises.writeFile(FILES_FILE, JSON.stringify(files, null, 2));
            res.json(files[index]);
        } else {
            res.status(404).json({ error: 'File not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/files/:id', async (req, res) => {
    try {
        const data = await fsPromises.readFile(FILES_FILE, 'utf8');
        const files = JSON.parse(data);
        const newFiles = files.filter(f => f.id !== req.params.id);
        await fsPromises.writeFile(FILES_FILE, JSON.stringify(newFiles, null, 2));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Serve uploaded files statically
app.use('/uploads', express.static(UPLOAD_DIR, {
    setHeaders: (res, filePath) => {
        // Set appropriate MIME type based on file extension
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.jpg' || ext === '.jpeg') {
            res.setHeader('Content-Type', 'image/jpeg');
        } else if (ext === '.png') {
            res.setHeader('Content-Type', 'image/png');
        } else if (ext === '.pdf') {
            res.setHeader('Content-Type', 'application/pdf');
        }
    }
}));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
