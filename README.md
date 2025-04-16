# EasyShare - File Sharing Application

A React-based file sharing application that allows users to securely share files and folders with others. The application uses local storage for data persistence and supports modern browser features like the File System Access API.

## Features

- User authentication (signup/login)
- File upload and management
- Local folder sharing using File System Access API
- File preview support for:
  - Images
  - Videos
  - Audio files
  - PDFs
- Interactive file/folder browser
- Media carousel for image/video galleries
- File sharing with other users
- Download permission controls
- Responsive design using Bootstrap

## Technology Stack

- React.js 18
- React Router v6
- Bootstrap 5
- Local Storage for data persistence
- File System Access API for folder access

## Getting Started

1. Clone the repository:

```bash
git clone <repository-url>
cd Media-viewer
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm start
```

The application will run at `http://localhost:3000`

## Usage

1. Sign up for a new account or log in with existing credentials
2. Upload files using the file upload form
3. Share local folders using the folder selection option
4. Share files/folders with other users by email
5. Control download permissions for shared files
6. View shared files in the "Shared with Me" section

## Browser Compatibility

- The folder sharing feature requires a modern browser that supports the File System Access API
- Recommended browsers: Chrome, Edge, or other Chromium-based browsers
- Basic file sharing works on all modern browsers

## Project Structure

- `/src`
  - `/components` - React components
  - `/contexts` - Context providers
  - `/services` - Data services
  - `App.js` - Main application component
  - `index.js` - Application entry point

## Security Notes

- This is a demo application using local storage
- In a production environment, implement:
  - Secure authentication
  - Server-side storage
  - File encryption
  - Proper access controls
  - Content validation

## License

MIT License - Feel free to use this project for personal or commercial purposes.
