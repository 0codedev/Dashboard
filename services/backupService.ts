import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';
import { ChatMessage } from '../types';

export const backupChatHistory = async (history: ChatMessage[]) => {
    const user = auth.currentUser;
    if (!user) {
        console.warn("Cannot backup chat history: No user logged in.");
        return;
    }

    const backupRef = doc(db, 'backups', user.uid);
    const backupData = {
        uid: user.uid,
        data: JSON.stringify(history),
        updatedAt: new Date().toISOString()
    };

    try {
        await setDoc(backupRef, backupData);
        console.log("Chat history backed up to Firestore.");
    } catch (error) {
        console.error("Error backing up chat history to Firestore:", error);
    }
};

export const downloadChatHistoryAsJSON = (history: ChatMessage[]) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(history));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "chat_history_backup.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
};
