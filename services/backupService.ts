import { doc, setDoc } from 'firebase/firestore';
import { db, auth } from './firebase';

export const backupFullDataToFirebase = async (data: any) => {
    const user = auth.currentUser;
    if (!user) {
        console.warn("Cannot backup data: No user logged in.");
        return;
    }

    const backupRef = doc(db, 'backups', user.uid);
    const backupData = {
        uid: user.uid,
        data: JSON.stringify(data),
        updatedAt: new Date().toISOString()
    };

    try {
        await setDoc(backupRef, backupData);
        console.log("Full data backed up to Firebase.");
        // Reset unsaved changes count after successful backup
        localStorage.setItem('unsaved_changes_count', '0');
        localStorage.setItem('last_auto_backup_time', new Date().toISOString());
    } catch (error) {
        console.error("Error backing up data to Firebase:", error);
        throw error;
    }
};

export const downloadDataAsJSON = (data: any, filename: string) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", filename);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
};
