// Singleton Supabase client pro celou aplikaci
export class SupabaseClient {
    static instance = null;
    
    static getInstance() {
        if (!SupabaseClient.instance) {
            SupabaseClient.instance = SupabaseClient.createClient();
        }
        return SupabaseClient.instance;
    }
    
    static createClient() {
        const SUPABASE_URL = 'https://gonsippgsrbutwanzpyo.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdvbnNpcHBnc3JidXR3YW56cHlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU3NDY4NzQsImV4cCI6MjA1MTMyMjg3NH0.PaQ9apEMR5nBe5Lw0xq2bnqE5W8ddYPW_X1fh9TzKNI';
        
        if (typeof window !== 'undefined' && window.supabase) {
            console.log('📦 Creating Supabase client instance...');
            return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        }
        
        console.warn('⚠️ Supabase not available, running in offline mode');
        return null;
    }
    
    static isAvailable() {
        return typeof window !== 'undefined' && window.supabase;
    }
}