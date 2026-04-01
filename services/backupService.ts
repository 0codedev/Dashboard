import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { storage, auth } from './firebase'; // Make sure this path points to your firebase config file

// ==========================================
// 1. THE BACKUP PIPELINE (Upload to Cloud)
// ==========================================
export const backupFullDataToFirebase = async (data: any) => {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("Cannot backup data: No user logged in.");
    }

    // Target the specific secure folder we created in the rules
    const backupRef = ref(storage, `backups/${user.uid}/data_backup.json`);
    
    // Convert the database object into a string
    const backupDataString = JSON.stringify(data);

    try {
        console.log("Starting cloud sync...");
        
        // Upload the raw JSON string
        const uploadTask = uploadString(backupRef, backupDataString, 'raw');
        
        // 90-second timeout for large files on Indian networks
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Firebase Storage Upload timed out')), 90000)
        );
        
        await Promise.race([uploadTask, timeoutPromise]);
        
        console.log("SUCCESS: Data secured in Firebase Storage.");
        
        // Clear local unsaved warnings
        localStorage.setItem('unsaved_changes_count', '0');
        localStorage.setItem('last_auto_backup_time', new Date().toISOString());
        
        return true;
    } catch (error) {
        console.error("FATAL ERROR: Cloud sync failed:", error);
        throw error;
    }
};

// ==========================================
// 2. THE RESTORE PIPELINE (Download from Cloud)
// ==========================================
export const restoreDataFromFirebase = async () => {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("Cannot restore data: No user logged in.");
    }

    // Target the exact same secure file
    const backupRef = ref(storage, `backups/${user.uid}/data_backup.json`);

    try {
        console.log("Fetching backup from cloud...");
        
        // Step A: Get the secure, temporary download URL from Firebase
        const downloadUrl = await getDownloadURL(backupRef);
        
        // Step B: Fetch the actual JSON file using the browser's native fetch API
        const response = await fetch(downloadUrl);
        
        if (!response.ok) {
            throw new Error("Failed to fetch the file from the cloud.");
        }

        // Step C: Parse the JSON string back into a JavaScript object
        const restoredData = await response.json();
        
        console.log("SUCCESS: Data successfully downloaded and parsed.");
        return restoredData;
        
    } catch (error) {
        console.error("RESTORE ERROR: Could not pull data from Firebase:", error);
        throw error;
    }
};