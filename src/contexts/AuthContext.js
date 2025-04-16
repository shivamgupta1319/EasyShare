import React, { useContext, useState, useEffect, createContext } from 'react';
import { findUserByEmail, createUser } from '../services/localDataService';

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    function signup(email, password) {
        // Check if user already exists
        const existingUser = findUserByEmail(email);
        if (existingUser) {
            return Promise.reject(new Error('User already exists'));
        }

        // Create new user
        const newUser = createUser(email, password);
        setCurrentUser(newUser);
        // Save current user to session storage
        sessionStorage.setItem('currentUser', JSON.stringify(newUser));
        return Promise.resolve(newUser);
    }

    function login(email, password) {
        const user = findUserByEmail(email);

        if (!user || user.password !== password) {
            return Promise.reject(new Error('Invalid email or password'));
        }

        // Remove password from user object before storing in state
        const { password: _, ...userWithoutPassword } = user;
        setCurrentUser(userWithoutPassword);
        // Save current user to session storage
        sessionStorage.setItem('currentUser', JSON.stringify(userWithoutPassword));
        return Promise.resolve(userWithoutPassword);
    }

    function logout() {
        setCurrentUser(null);
        sessionStorage.removeItem('currentUser');
        return Promise.resolve();
    }

    useEffect(() => {
        // Check if user is logged in from session storage
        const user = sessionStorage.getItem('currentUser');
        if (user) {
            setCurrentUser(JSON.parse(user));
        }
        setLoading(false);
    }, []);

    const value = {
        currentUser,
        signup,
        login,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
} 