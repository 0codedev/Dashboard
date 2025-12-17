
declare global {
    interface Window {
        google: any;
        gapi: any;
    }
}

export interface DriveFile {
    id: string;
    name: string;
    createdTime: string;
}

class GoogleDriveService {
    private tokenClient: any = null;
    private accessToken: string | null = null;
    private clientId: string | null = null;
    private gapiInited: boolean = false;
    private gisInited: boolean = false;

    // Use a specific file name or dynamic?
    // Let's list files of a certain mimeType or name pattern if needed.
    
    public init(clientId: string) {
        this.clientId = clientId;
        this.loadScripts();
    }

    private loadScripts() {
        if (!window.gapi) {
            console.error("GAPI script not loaded in index.html");
            return;
        }
        if (!window.google) {
            console.error("Google Identity Services script not loaded in index.html");
            return;
        }

        // Load GAPI
        window.gapi.load('client', async () => {
            await window.gapi.client.init({
                // apiKey: API_KEY, // Optional for some scopes, but we are using Token Model
                discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
            });
            this.gapiInited = true;
        });

        // Load GIS
        this.tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: this.clientId,
            scope: 'https://www.googleapis.com/auth/drive.file', // Only access files created by this app
            callback: (tokenResponse: any) => {
                this.accessToken = tokenResponse.access_token;
            },
        });
        this.gisInited = true;
    }

    public async signIn(): Promise<string> {
        return new Promise((resolve, reject) => {
            if (!this.tokenClient) {
                if (!this.clientId) return reject("Client ID not configured.");
                // Try initializing again if scripts loaded late
                this.loadScripts();
                if (!this.tokenClient) return reject("Google Drive Service not initialized properly.");
            }

            this.tokenClient.callback = (resp: any) => {
                if (resp.error !== undefined) {
                    reject(resp);
                }
                this.accessToken = resp.access_token;
                resolve(this.accessToken!);
            };

            // Prompt user
            this.tokenClient.requestAccessToken({ prompt: 'consent' });
        });
    }

    public async uploadBackup(data: any, filename: string): Promise<void> {
        if (!this.accessToken) await this.signIn();
        
        const fileContent = JSON.stringify(data);
        const file = new Blob([fileContent], { type: 'application/json' });
        const metadata = {
            'name': filename,
            'mimeType': 'application/json'
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: new Headers({ 'Authorization': 'Bearer ' + this.accessToken }),
            body: form
        });

        if (!response.ok) {
            throw new Error('Upload failed: ' + response.statusText);
        }
    }

    public async listBackups(): Promise<DriveFile[]> {
        if (!this.accessToken) await this.signIn();

        // Ensure gapi client is ready
        if (!this.gapiInited) {
             await new Promise<void>((resolve) => {
                 const check = setInterval(() => {
                     if (this.gapiInited) { clearInterval(check); resolve(); }
                 }, 100);
             });
        }

        const response = await window.gapi.client.drive.files.list({
            'pageSize': 20,
            'fields': "nextPageToken, files(id, name, createdTime)",
            'q': "mimeType = 'application/json' and trashed = false" 
        });

        return response.result.files;
    }

    public async downloadBackup(fileId: string): Promise<any> {
        if (!this.accessToken) await this.signIn();

        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            method: 'GET',
            headers: new Headers({ 'Authorization': 'Bearer ' + this.accessToken })
        });

        if (!response.ok) throw new Error("Download failed");
        return await response.json();
    }
}

export const googleDriveService = new GoogleDriveService();
