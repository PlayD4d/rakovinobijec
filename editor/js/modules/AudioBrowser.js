/**
 * AudioBrowser.js - Modal dialog for browsing and selecting audio files
 * PR7 compliant - uses direct file scanning instead of manifest
 */

import { audioScanner } from './AudioScanner.js';

export class AudioBrowser {
    constructor(editor) {
        this.editor = editor;
        this.currentCategory = 'all';
        this.searchTerm = '';
        this.audioFiles = null;
        this.currentAudio = null; // For audio preview
        this.onSelectCallback = null;
        
        this.loadAudioFiles();
        this.createModal();
    }
    
    /**
     * Load available audio files using AudioScanner
     */
    async loadAudioFiles() {
        try {
            this.audioFiles = await audioScanner.getAudioFiles();
            console.log('[AudioBrowser] Loaded', this.audioFiles.all.length, 'audio files');
        } catch (error) {
            console.error('[AudioBrowser] Failed to load audio files:', error);
            // Fallback to empty data
            this.audioFiles = {
                music: [],
                sfx: [],
                all: []
            };
        }
    }
    
    /**
     * Create the modal dialog
     */
    createModal() {
        this.modal = document.createElement('div');
        this.modal.className = 'audio-browser-modal';
        this.modal.innerHTML = `
            <div class="audio-browser-backdrop"></div>
            <div class="audio-browser-content">
                <div class="audio-browser-header">
                    <h3>🎵 Audio Browser</h3>
                    <button class="btn-close">×</button>
                </div>
                
                <div class="audio-browser-toolbar">
                    <div class="audio-search">
                        <input type="text" id="audio-search" placeholder="Search audio files..." />
                        <button class="btn-clear-search">×</button>
                    </div>
                    
                    <div class="audio-categories">
                        <select id="audio-category">
                            <option value="all">All Audio</option>
                            <option value="player">Player Sounds</option>
                            <option value="enemy">Enemy Sounds</option>
                            <option value="weapon">Weapon Sounds</option>
                            <option value="ui">UI Sounds</option>
                            <option value="boss">Boss Sounds</option>
                            <option value="pickup">Pickup Sounds</option>
                        </select>
                    </div>
                    
                    <button class="btn-add-audio">➕ Add New Audio</button>
                </div>
                
                <div class="audio-browser-body">
                    <div class="audio-list" id="audio-list">
                        <!-- Audio items will be populated here -->
                    </div>
                </div>
                
                <div class="audio-browser-footer">
                    <div class="audio-preview">
                        <span id="current-preview">No audio selected</span>
                        <button id="btn-play" disabled>▶️ Play</button>
                        <button id="btn-stop" disabled>⏹️ Stop</button>
                    </div>
                    
                    <div class="audio-actions">
                        <button class="btn-cancel">Cancel</button>
                        <button class="btn-select" disabled>Select</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.modal);
        this.setupEventListeners();
        this.updateAudioList();
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Close modal
        this.modal.querySelector('.btn-close').addEventListener('click', () => this.close());
        this.modal.querySelector('.btn-cancel').addEventListener('click', () => this.close());
        this.modal.querySelector('.audio-browser-backdrop').addEventListener('click', () => this.close());
        
        // Search
        const searchInput = this.modal.querySelector('#audio-search');
        searchInput.addEventListener('input', (e) => {
            this.searchTerm = e.target.value.toLowerCase();
            this.updateAudioList();
        });
        
        this.modal.querySelector('.btn-clear-search').addEventListener('click', () => {
            searchInput.value = '';
            this.searchTerm = '';
            this.updateAudioList();
        });
        
        // Category filter
        this.modal.querySelector('#audio-category').addEventListener('change', (e) => {
            this.currentCategory = e.target.value;
            this.updateAudioList();
        });
        
        // Audio preview
        this.modal.querySelector('#btn-play').addEventListener('click', () => this.playPreview());
        this.modal.querySelector('#btn-stop').addEventListener('click', () => this.stopPreview());
        
        // Select audio
        this.modal.querySelector('.btn-select').addEventListener('click', () => this.selectCurrentAudio());
        
        // Add new audio
        this.modal.querySelector('.btn-add-audio').addEventListener('click', () => this.showAddAudioDialog());
    }
    
    /**
     * Update the audio list display
     */
    async updateAudioList() {
        // Make sure audio files are loaded
        if (!this.audioFiles) {
            await this.loadAudioFiles();
        }
        
        if (!this.audioFiles) return;
        
        const listContainer = this.modal.querySelector('#audio-list');
        listContainer.innerHTML = '';
        
        // PR7: Use direct file paths from AudioScanner
        let filteredFiles = this.audioFiles.all;
        
        // Apply search filter
        if (this.searchTerm) {
            filteredFiles = filteredFiles.filter(file => 
                file.key.toLowerCase().includes(this.searchTerm) ||
                file.displayName.toLowerCase().includes(this.searchTerm) ||
                file.path.toLowerCase().includes(this.searchTerm)
            );
        }
        
        // Apply category filter
        if (this.currentCategory !== 'all') {
            filteredFiles = filteredFiles.filter(file => 
                this.matchesCategory(file.key, this.currentCategory)
            );
        }
        
        // Create audio items
        filteredFiles.forEach(file => {
            const item = this.createAudioItem(file.key, file.path);
            listContainer.appendChild(item);
        });
        
        if (filteredFiles.length === 0) {
            listContainer.innerHTML = '<div class="no-results">No audio files found</div>';
        }
    }
    
    /**
     * Get direct audio file paths for use in blueprints
     * @returns {Object} - mapping of direct file paths to themselves
     */
    getDirectAudioFiles() {
        // Create a list of direct file paths that can be used in blueprints
        // This allows users to select "sound/laser.mp3" directly
        
        const directFiles = {};
        
        if (!this.audioFiles) return directFiles;
        
        // Convert audioFiles to direct path mapping
        this.audioFiles.all.forEach(file => {
            directFiles[file.path] = file.path;
        });
        
        return directFiles;
    }
    
    /**
     * Detect if audio key is a direct file path
     * @param {string} key 
     * @returns {boolean}
     */
    isDirectFilePath(key) {
        // Same logic as SFXSystem._isDirectFilePath()
        if (key.startsWith('sfx.')) {
            return false; // Registry ID
        }
        
        if (key.includes('/') || /\.(mp3|ogg|wav|m4a)$/i.test(key)) {
            return true; // Direct file path
        }
        
        return false; // Default to registry lookup
    }
    
    /**
     * Filter audio based on current criteria
     */
    filterAudio(files) {
        if (!files) return [];
        
        return files.filter(file => {
            // Search filter
            if (this.searchTerm) {
                const searchLower = this.searchTerm.toLowerCase();
                if (!file.key.toLowerCase().includes(searchLower) && 
                    !file.displayName.toLowerCase().includes(searchLower) &&
                    !file.path.toLowerCase().includes(searchLower)) {
                    return false;
                }
            }
            
            // Category filter
            if (this.currentCategory !== 'all' && !this.matchesCategory(file.key, this.currentCategory)) {
                return false;
            }
            
            return true;
        });
    }
    
    /**
     * Check if audio key matches category
     */
    matchesCategory(key, category) {
        const lowerKey = key.toLowerCase();
        
        switch (category) {
            case 'player':
                return lowerKey.includes('player') || lowerKey.includes('heal') || lowerKey.includes('levelup');
            case 'enemy':
                return lowerKey.includes('npc') || lowerKey.includes('enemy') || lowerKey.includes('elite');
            case 'weapon':
                return lowerKey.includes('shoot') || lowerKey.includes('laser') || lowerKey.includes('projectile') || 
                       lowerKey.includes('machinegun') || lowerKey.includes('flamethrower');
            case 'ui':
                return lowerKey.includes('bleep') || lowerKey.includes('chime') || lowerKey.includes('intro') || 
                       lowerKey.includes('game_over');
            case 'boss':
                return lowerKey.includes('boss');
            case 'pickup':
                return lowerKey.includes('pickup') || lowerKey.includes('powerup') || lowerKey.includes('metotrexat');
            default:
                return true;
        }
    }
    
    /**
     * Create an audio list item
     */
    createAudioItem(key, path) {
        const item = document.createElement('div');
        item.className = 'audio-item';
        item.dataset.audioKey = path; // Use path as key for PR7
        item.dataset.audioPath = path;
        
        // Extract filename from path
        const filename = path.split('/').pop();
        const displayName = filename.replace('.mp3', '').replace(/_/g, ' ');
        
        // Determine icon based on category
        const icon = this.getAudioIcon(key);
        
        item.innerHTML = `
            <div class="audio-info">
                <div class="audio-icon">${icon}</div>
                <div class="audio-details">
                    <div class="audio-name">
                        📁 ${displayName}
                        <span class="audio-type-label">Direct</span>
                    </div>
                    <div class="audio-path">${path}</div>
                </div>
            </div>
            <div class="audio-actions">
                <button class="btn-preview" data-audio-path="${path}">▶️</button>
            </div>
        `;
        
        // Add CSS class for styling
        item.classList.add('audio-item-direct');
        
        // Click to select - pass path as both key and path
        item.addEventListener('click', () => this.selectAudio(path, path));
        
        // Preview button
        item.querySelector('.btn-preview').addEventListener('click', (e) => {
            e.stopPropagation();
            this.previewAudio(path, path);
        });
        
        return item;
    }
    
    /**
     * Get appropriate icon for audio type
     */
    getAudioIcon(key) {
        const lowerKey = key.toLowerCase();
        
        if (lowerKey.includes('player')) return '👤';
        if (lowerKey.includes('enemy') || lowerKey.includes('npc')) return '👾';
        if (lowerKey.includes('boss')) return '👹';
        if (lowerKey.includes('weapon') || lowerKey.includes('shoot') || lowerKey.includes('laser')) return '🔫';
        if (lowerKey.includes('pickup') || lowerKey.includes('powerup')) return '💊';
        if (lowerKey.includes('explosion')) return '💥';
        if (lowerKey.includes('hit')) return '💢';
        if (lowerKey.includes('death')) return '💀';
        if (lowerKey.includes('heal')) return '💚';
        
        return '🔊';
    }
    
    /**
     * Select an audio file
     */
    selectAudio(key, path) {
        // Update selection UI
        this.modal.querySelectorAll('.audio-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        const selectedItem = this.modal.querySelector(`[data-audio-key="${key}"]`);
        if (selectedItem) {
            selectedItem.classList.add('selected');
        }
        
        // Update preview info
        this.modal.querySelector('#current-preview').textContent = `${key} (${path})`;
        
        // Enable buttons
        this.modal.querySelector('#btn-play').disabled = false;
        this.modal.querySelector('#btn-stop').disabled = false;
        this.modal.querySelector('.btn-select').disabled = false;
        
        // Store selection
        this.selectedAudio = { key, path };
    }
    
    /**
     * Preview audio file
     */
    previewAudio(key, path) {
        this.selectAudio(key, path);
        this.playPreview();
    }
    
    /**
     * Play audio preview
     */
    playPreview() {
        if (!this.selectedAudio) return;
        
        this.stopPreview(); // Stop any current audio
        
        try {
            // For editor preview, need to construct full path
            const fullPath = '../' + this.selectedAudio.path;
            this.currentAudio = new Audio(fullPath);
            this.currentAudio.volume = 0.5; // 50% volume for preview
            this.currentAudio.play().catch(error => {
                console.error('[AudioBrowser] Failed to play audio:', error);
                // Try without leading slash
                this.currentAudio = new Audio(this.selectedAudio.path);
                this.currentAudio.volume = 0.5;
                this.currentAudio.play().catch(err => {
                    console.error('[AudioBrowser] Retry failed:', err);
                    alert('Failed to play audio file. The file may not exist or be corrupted.');
                });
            });
            
            // Auto-stop when ended
            this.currentAudio.addEventListener('ended', () => {
                this.stopPreview();
            });
            
        } catch (error) {
            console.error('[AudioBrowser] Failed to play audio:', error);
            alert('Failed to play audio file. The file may not exist or be corrupted.');
        }
    }
    
    /**
     * Stop audio preview
     */
    stopPreview() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
        }
    }
    
    /**
     * Select current audio and close modal
     */
    selectCurrentAudio() {
        if (this.selectedAudio && this.onSelectCallback) {
            // PR7: Return the direct path, not the key
            this.onSelectCallback(this.selectedAudio.path);
        }
        this.close();
    }
    
    /**
     * Show add new audio dialog
     */
    showAddAudioDialog() {
        const message = [
            'Add new audio functionality coming soon!',
            '',
            'For now, please:',
            '1. Add your .mp3 file to the /sound/ or /music/ folder',
            '2. Update AudioScanner.js with the new file path',
            '3. Refresh the editor'
        ].join('\n');
        alert(message);
    }
    
    /**
     * Open the audio browser
     */
    open(onSelect) {
        this.onSelectCallback = onSelect;
        this.modal.style.display = 'block';
        
        // Focus search input
        setTimeout(() => {
            this.modal.querySelector('#audio-search').focus();
        }, 100);
    }
    
    /**
     * Close the audio browser
     */
    close() {
        this.stopPreview();
        this.modal.style.display = 'none';
        this.selectedAudio = null;
        this.onSelectCallback = null;
    }
    
    /**
     * Cleanup when destroying component
     */
    destroy() {
        this.stopPreview();
        if (this.modal && this.modal.parentNode) {
            this.modal.parentNode.removeChild(this.modal);
        }
    }
}

export default AudioBrowser;