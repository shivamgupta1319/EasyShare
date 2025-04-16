import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Dashboard from './components/Dashboard';
import SharedFiles from './components/SharedFiles';
import Login from './components/Login';
import Signup from './components/Signup';
import FileView from './components/FileView';
import Navbar from './components/Navbar';
import './App.css';

function App() {
    return (
        <Router>
            <AuthProvider>
                <Navbar />
                <div className="container mt-4">
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/signup" element={<Signup />} />
                        <Route path="/file/:fileId" element={<FileView />} />
                        <Route path="/shared" element={
                            <PrivateRoute>
                                <SharedFiles />
                            </PrivateRoute>
                        } />
                        <Route path="/" element={
                            <PrivateRoute>
                                <Dashboard />
                            </PrivateRoute>
                        } />
                    </Routes>
                </div>
            </AuthProvider>
        </Router>
    );
}

export default App; 