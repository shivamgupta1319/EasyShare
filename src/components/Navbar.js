import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
    const { currentUser, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    async function handleLogout() {
        try {
            await logout();
            navigate('/login');
        } catch (error) {
            console.error('Failed to log out', error);
        }
    }

    // Function to check if a path is active
    const isActive = (path) => {
        return location.pathname === path;
    };

    return (
        <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
            <div className="container">
                <Link className="navbar-brand" to="/">EasyShare</Link>

                <button
                    className="navbar-toggler"
                    type="button"
                    data-bs-toggle="collapse"
                    data-bs-target="#navbarContent"
                    aria-controls="navbarContent"
                    aria-expanded="false"
                    aria-label="Toggle navigation"
                >
                    <span className="navbar-toggler-icon"></span>
                </button>

                <div className="collapse navbar-collapse" id="navbarContent">
                    {currentUser && (
                        <ul className="navbar-nav mx-auto mb-2 mb-lg-0">
                            <li className="nav-item">
                                <Link
                                    className={`nav-link ${isActive('/') ? 'active fw-bold' : ''}`}
                                    to="/"
                                >
                                    My Files
                                </Link>
                            </li>
                            <li className="nav-item">
                                <Link
                                    className={`nav-link ${isActive('/shared') ? 'active fw-bold' : ''}`}
                                    to="/shared"
                                >
                                    Shared With Me
                                </Link>
                            </li>
                        </ul>
                    )}

                    <div className="navbar-nav ms-auto">
                        {currentUser ? (
                            <>
                                <span className="nav-link text-light">
                                    {currentUser.email}
                                </span>
                                <button className="btn btn-outline-light ms-2" onClick={handleLogout}>
                                    Log Out
                                </button>
                            </>
                        ) : (
                            <>
                                <Link
                                    className={`nav-link ${isActive('/login') ? 'active fw-bold' : ''}`}
                                    to="/login"
                                >
                                    Login
                                </Link>
                                <Link
                                    className={`nav-link ${isActive('/signup') ? 'active fw-bold' : ''}`}
                                    to="/signup"
                                >
                                    Sign Up
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
} 