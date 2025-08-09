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
        const DEFAULT_SUPABASE_URL = 'https://gonsippgsrbutwanzpyo.supabase.co';
        const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdvbnNpcHBnc3JidXR3YW56cHlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3MzAyNDEsImV4cCI6MjA3MDMwNjI0MX0.2FINt1ku94IMVYzp7zKJvFSt0Z7t6gj-lCsAwcwMCXs';

        const SUPABASE_URL = (typeof window !== 'undefined' && window.__SUPABASE_URL__) || DEFAULT_SUPABASE_URL;
        const SUPABASE_ANON_KEY = (typeof window !== 'undefined' && window.__SUPABASE_ANON_KEY__) || DEFAULT_SUPABASE_ANON_KEY;

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