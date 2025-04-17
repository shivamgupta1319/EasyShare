/* eslint-disable import/no-anonymous-default-export */
/**
 * API Testing Utility
 * 
 * This file provides functions for testing API endpoints directly
 * from the browser console to help debug issues.
 */

// Test the folder connection API
export const testFolderConnect = async (folderId, userId) => {
    try {
        console.log(`Testing folder connection API for folder ${folderId}`);

        // Direct API call - bypassing service layer
        const response = await fetch(`/api/files/${folderId}/connect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });

        console.log('Response status:', response.status);

        const responseText = await response.text();
        console.log('Response body:', responseText);

        if (response.ok) {
            try {
                const data = JSON.parse(responseText);
                console.log('Parsed JSON response:', data);
                return { success: true, data };
            } catch (e) {
                console.error('Failed to parse JSON response:', e);
                return { success: false, error: 'Invalid JSON response', raw: responseText };
            }
        } else {
            return {
                success: false,
                status: response.status,
                error: `API returned ${response.status}: ${response.statusText}`,
                raw: responseText
            };
        }
    } catch (error) {
        console.error('API test failed:', error);
        return { success: false, error: error.message };
    }
};

// Make accessible from browser console
if (typeof window !== 'undefined') {
    window.apiTest = { testFolderConnect };
    console.log('API test utilities available as window.apiTest');
}

export default { testFolderConnect };
