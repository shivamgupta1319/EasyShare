import React, { useContext, useState, useEffect, createContext } from 'react';
import { findUserByEmail, createUser } from '../services/localDataService';

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    async function signup(email, password) {
        try {
            const existingUser = await findUserByEmail(email);
            if (existingUser) {
                throw new Error('User already exists');
            }

            const newUser = await createUser(email, password);
            // Remove password before setting to state
            const { password: _, ...userWithoutPassword } = newUser;
            setCurrentUser(userWithoutPassword);
            sessionStorage.setItem('currentUser', JSON.stringify(userWithoutPassword));
            return userWithoutPassword;
        } catch (error) {
            throw error;
        }
    }

    async function login(email, password) {
        try {
            const user = await findUserByEmail(email);
            if (!user || user.password !== password) {
                throw new Error('Invalid email or password');
            }

            const { password: _, ...userWithoutPassword } = user;
            setCurrentUser(userWithoutPassword);
            sessionStorage.setItem('currentUser', JSON.stringify(userWithoutPassword));
            return userWithoutPassword;
        } catch (error) {
            throw error;
        }
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