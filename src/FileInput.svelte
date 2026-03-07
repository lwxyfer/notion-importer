<script>
    export let files = [];
    export let accept_ext = [];
    export let disabled = false;
    export let labelText = 'Drop ZIP file here or click to browse';
    let dragOver = false;
    let fileInput;

    function handleFileChange(event) {
        files = Array.from(event.target.files);
    }

    function handleDrop(event) {
        event.preventDefault();
        dragOver = false;
        if (disabled) return;
        const droppedFiles = Array.from(event.dataTransfer.files);
        // Filter by accepted extensions
        if (accept_ext.length > 0) {
            files = droppedFiles.filter(f => accept_ext.some(ext => f.name.toLowerCase().endsWith(ext)));
        } else {
            files = droppedFiles;
        }
        // Sync the input element
        if (fileInput && files.length > 0) {
            const dt = new DataTransfer();
            files.forEach(f => dt.items.add(f));
            fileInput.files = dt.files;
        }
    }

    function handleDragOver(event) {
        event.preventDefault();
        if (!disabled) dragOver = true;
    }

    function handleDragLeave() {
        dragOver = false;
    }

    function handleClick() {
        if (!disabled && fileInput) fileInput.click();
    }

    function formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<div
    class="file-drop-zone"
    class:drag-over={dragOver}
    class:disabled={disabled}
    class:has-file={files.length > 0}
    on:drop={handleDrop}
    on:dragover={handleDragOver}
    on:dragleave={handleDragLeave}
    on:click={handleClick}
    role="button"
    tabindex="0"
>
    <input
        bind:this={fileInput}
        type="file"
        accept={accept_ext.join(',')}
        on:change={handleFileChange}
        {disabled}
    />

    {#if files.length > 0}
        <div class="file-info">
            <svg class="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
            </svg>
            <div class="file-details">
                <span class="file-name">{files[0].name}</span>
                <span class="file-size">{formatSize(files[0].size)}</span>
            </div>
        </div>
    {:else}
        <div class="drop-prompt">
            <svg class="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <span class="drop-text">{labelText}</span>
        </div>
    {/if}
</div>

<style>
    .file-drop-zone {
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px dashed var(--b3-border-color, #d1d5db);
        border-radius: 8px;
        padding: 24px 16px;
        cursor: pointer;
        transition: all 0.2s ease;
        background: var(--b3-theme-background, #fff);
        min-height: 80px;
    }

    .file-drop-zone:hover:not(.disabled) {
        border-color: var(--b3-theme-primary, #4285f4);
        background: var(--b3-theme-surface, rgba(66, 133, 244, 0.04));
    }

    .file-drop-zone.drag-over {
        border-color: var(--b3-theme-primary, #4285f4);
        background: var(--b3-theme-primary-lighter, rgba(66, 133, 244, 0.08));
        border-style: solid;
    }

    .file-drop-zone.disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .file-drop-zone.has-file {
        border-style: solid;
        border-color: var(--b3-theme-primary, #4285f4);
    }

    .file-drop-zone input[type="file"] {
        display: none;
    }

    .drop-prompt {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        color: var(--b3-theme-on-surface, #666);
    }

    .upload-icon {
        width: 32px;
        height: 32px;
        opacity: 0.6;
    }

    .drop-text {
        font-size: 13px;
    }

    .file-info {
        display: flex;
        align-items: center;
        gap: 12px;
        color: var(--b3-theme-on-background, #333);
    }

    .file-icon {
        width: 24px;
        height: 24px;
        color: var(--b3-theme-primary, #4285f4);
        flex-shrink: 0;
    }

    .file-details {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .file-name {
        font-size: 13px;
        font-weight: 500;
        word-break: break-all;
    }

    .file-size {
        font-size: 12px;
        color: var(--b3-theme-on-surface, #888);
    }
</style>
