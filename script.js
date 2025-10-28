const API_BASE = 'http://localhost:3000/api';

// Global State
let currentSpace = null;
let userToken = null;
let userRole = null;
let allContents = [];
let activeTabIndex = 0;

// DOM Elements
const homePage = document.getElementById('homePage');
const spaceNameInput = document.getElementById('spaceNameInput');
const goButton = document.getElementById('goButton');
const passwordOverlay = document.getElementById('passwordOverlay');
const passwordContent = document.getElementById('passwordContent');
const closePasswordModal = document.getElementById('closePasswordModal');
const spaceViewer = document.getElementById('spaceViewer');
const backButton = document.getElementById('backButton');
const loading = document.getElementById('loading');
const messages = document.getElementById('messages');
const tabsList = document.getElementById('tabsList');
const tabContent = document.getElementById('tabContent');
const addTabButton = document.getElementById('addTabButton');
const imageLightbox = document.getElementById('imageLightbox');
const lightboxImage = document.getElementById('lightboxImage');
const closeLightbox = document.getElementById('closeLightbox');

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    goButton.addEventListener('click', handleGo);
    spaceNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleGo();
    });
    closePasswordModal.addEventListener('click', closePasswordOverlay);
    backButton.addEventListener('click', showHomePage);
    addTabButton.addEventListener('click', handleAddNewTab);
    closeLightbox.addEventListener('click', closeLightboxModal);
    imageLightbox.addEventListener('click', (e) => {
        if (e.target === imageLightbox) closeLightboxModal();
    });
    
    // Close overlay when clicking outside
    passwordOverlay.addEventListener('click', (e) => {
        if (e.target === passwordOverlay) closePasswordOverlay();
    });
});

// Handle Go Button
async function handleGo() {
    const spaceName = spaceNameInput.value.trim();
    
    if (!spaceName) {
        showMessage('Please enter a space name', 'error');
        return;
    }
    
    if (!/^[a-zA-Z0-9-_]{3,40}$/.test(spaceName)) {
        showMessage('Space name must be 3-40 characters (letters, numbers, hyphens, underscores)', 'error');
        return;
    }
    
    currentSpace = spaceName;
    
    try {
        showLoading(true);
        const response = await fetch(`${API_BASE}/spaces/${encodeURIComponent(spaceName)}/exists`);
        const result = await response.json();
        
        if (result.exists) {
            showExistingSpacePasswordForm(spaceName);
        } else {
            showNewSpacePasswordForm(spaceName);
        }
    } catch (error) {
        console.error('Check space error:', error);
        showMessage('Failed to check space', 'error');
    } finally {
        showLoading(false);
    }
}

// Show password form for existing space
function showExistingSpacePasswordForm(spaceName) {
    passwordContent.innerHTML = `
        <h2>Welcome Back!</h2>
        <h3>Space: ${escapeHtml(spaceName)}</h3>
        <div class="info-text">
            Enter your password to access this space.
            Use your <strong>view password</strong> for read-only access, or <strong>admin password</strong> for full control.
        </div>
        <form id="existingSpaceForm">
            <div class="form-group">
                <label for="existingPassword">Password</label>
                <input type="password" id="existingPassword" placeholder="Enter your password" required autofocus />
            </div>
            <button type="submit" class="btn-submit">Enter Space</button>
        </form>
    `;
    
    document.getElementById('existingSpaceForm').addEventListener('submit', handleExistingSpaceLogin);
    passwordOverlay.style.display = 'flex';
}

// Show password form for new space
function showNewSpacePasswordForm(spaceName) {
    passwordContent.innerHTML = `
        <h2>Create New Space</h2>
        <h3>Space: ${escapeHtml(spaceName)}</h3>
        <div class="info-text">
            This space doesn't exist yet. Set up two passwords:
            <ul style="margin-top: 10px; padding-left: 20px;">
                <li><strong>View Password</strong> - For read-only access</li>
                <li><strong>Admin Password</strong> - For full control (add, edit, delete)</li>
            </ul>
        </div>
        <form id="newSpaceForm">
            <div class="form-group">
                <label for="newViewPassword">View Password</label>
                <input type="password" id="newViewPassword" placeholder="For viewing content (min 6 chars)" required minlength="6" autofocus />
                <small>Share this with people who should only view your content</small>
            </div>
            <div class="form-group">
                <label for="newAdminPassword">Admin Password</label>
                <input type="password" id="newAdminPassword" placeholder="For managing content (min 6 chars)" required minlength="6" />
                <small>Keep this private - it allows full control over the space</small>
            </div>
            <button type="submit" class="btn-submit">Create Space</button>
        </form>
    `;
    
    document.getElementById('newSpaceForm').addEventListener('submit', handleCreateSpace);
    passwordOverlay.style.display = 'flex';
}

// Handle existing space login
async function handleExistingSpaceLogin(e) {
    e.preventDefault();
    const password = document.getElementById('existingPassword').value;
    
    try {
        showLoading(true);
        const response = await fetch(`${API_BASE}/spaces/${encodeURIComponent(currentSpace)}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            userToken = result.token;
            userRole = result.role;
            sessionStorage.setItem(`token:${currentSpace}`, userToken);
            sessionStorage.setItem(`role:${currentSpace}`, userRole);
            
            closePasswordOverlay();
            await loadSpace(currentSpace);
            showMessage(`Logged in as ${userRole === 'admin' ? 'Admin' : 'Viewer'}`, 'success');
        } else {
            showMessage(result.error || 'Invalid password', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage('Login failed', 'error');
    } finally {
        showLoading(false);
    }
}

// Handle create new space
async function handleCreateSpace(e) {
    e.preventDefault();
    const viewPassword = document.getElementById('newViewPassword').value;
    const adminPassword = document.getElementById('newAdminPassword').value;
    
    if (viewPassword.length < 6 || adminPassword.length < 6) {
        showMessage('Passwords must be at least 6 characters', 'error');
        return;
    }
    
    if (viewPassword === adminPassword) {
        showMessage('View and Admin passwords should be different', 'error');
        return;
    }
    
    try {
        showLoading(true);
        const response = await fetch(`${API_BASE}/spaces`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: currentSpace, viewPassword, adminPassword })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showMessage('Space created successfully!', 'success');
            userToken = result.token;
            userRole = 'admin';
            sessionStorage.setItem(`token:${currentSpace}`, userToken);
            sessionStorage.setItem(`role:${currentSpace}`, userRole);
            
            closePasswordOverlay();
            await loadSpace(currentSpace);
        } else {
            showMessage(result.error || 'Failed to create space', 'error');
        }
    } catch (error) {
        console.error('Create space error:', error);
        showMessage('Failed to create space', 'error');
    } finally {
        showLoading(false);
    }
}

// Load Space Content
async function loadSpace(spaceName) {
    try {
        showLoading(true);
        currentSpace = spaceName;
        
        const token = userToken || sessionStorage.getItem(`token:${spaceName}`);
        const role = userRole || sessionStorage.getItem(`role:${spaceName}`);
        
        if (!token) {
            showMessage('Please login to view this space', 'error');
            showLoading(false);
            return;
        }
        
        const response = await fetch(`${API_BASE}/spaces/${encodeURIComponent(spaceName)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();
        
        if (response.ok) {
            allContents = result.space.contents || [];
            displaySpaceWithTabs(result.space);
            showSpaceViewer();
        } else {
            showMessage(result.error || 'Space not found', 'error');
        }
    } catch (error) {
        console.error('Load space error:', error);
        showMessage('Failed to load space', 'error');
    } finally {
        showLoading(false);
    }
}

// Display Space with Tabs
function displaySpaceWithTabs(space) {
    document.getElementById('spaceTitle').textContent = space.name;
    
    // Update admin status
    const adminStatus = document.getElementById('adminStatus');
    const role = userRole || sessionStorage.getItem(`role:${space.name}`);
    
    if (role === 'admin') {
        adminStatus.innerHTML = '🔓 <strong>Admin</strong>';
        adminStatus.style.color = '#fff';
        addTabButton.style.display = 'block';
    } else if (role === 'viewer') {
        adminStatus.innerHTML = '👁️ <strong>Viewer</strong>';
        adminStatus.style.color = '#fff';
        addTabButton.style.display = 'none';
    } else {
        adminStatus.innerHTML = '🔒 Not logged in';
        adminStatus.style.color = '#fff';
        addTabButton.style.display = 'none';
    }
    
    // Render tabs
    renderTabs();
    
    // Show first tab or empty message
    if (allContents.length > 0) {
        showTab(0);
    } else {
        showEmptyState();
    }
}

// Render Tabs
function renderTabs() {
    tabsList.innerHTML = '';
    
    allContents.forEach((content, index) => {
        const tab = document.createElement('div');
        tab.className = `tab-item ${index === activeTabIndex ? 'active' : ''}`;
        
        const title = document.createElement('span');
        title.className = 'tab-title';
        title.textContent = `Tab ${index + 1}`;
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'tab-close';
        closeBtn.innerHTML = '×';
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            handleDeleteTab(index);
        };
        
        tab.appendChild(title);
        
        // Only show close button for admin
        const role = userRole || sessionStorage.getItem(`role:${currentSpace}`);
        if (role === 'admin') {
            tab.appendChild(closeBtn);
        }
        
        tab.onclick = () => showTab(index);
        tabsList.appendChild(tab);
    });
}

// Show Tab Content
function showTab(index) {
    if (index < 0 || index >= allContents.length) return;
    
    activeTabIndex = index;
    renderTabs();
    
    const content = allContents[index];
    const role = userRole || sessionStorage.getItem(`role:${currentSpace}`);
    const isAdmin = role === 'admin';
    
    tabContent.innerHTML = '';
    
    const container = document.createElement('div');
    container.className = 'content-display';
    
    // Text content (always show, even if empty for admins)
    const textDiv = document.createElement('div');
    textDiv.className = isAdmin ? 'content-text-editable' : 'content-text-display';
    textDiv.contentEditable = isAdmin;
    textDiv.textContent = content.text || (isAdmin ? 'Click here to add text...' : 'No text content');
    
    if (isAdmin) {
        textDiv.dataset.originalText = content.text || '';
        textDiv.dataset.contentId = content._id || content.id;
        
        // Handle placeholder text
        if (!content.text) {
            textDiv.style.color = '#999';
            textDiv.addEventListener('focus', function() {
                if (this.textContent === 'Click here to add text...') {
                    this.textContent = '';
                    this.style.color = '#333';
                }
            }, { once: true });
        }
        
        // Use blur event instead of input for better control
        textDiv.addEventListener('blur', () => {
            const currentText = textDiv.textContent.trim();
            const originalText = textDiv.dataset.originalText.trim();
            
            if (currentText !== originalText) {
                showSaveButton(textDiv.dataset.contentId, textDiv);
            }
        });
        
        // Also trigger on input for immediate feedback
        textDiv.addEventListener('input', () => {
            const currentText = textDiv.textContent.trim();
            const originalText = textDiv.dataset.originalText.trim();
            
            if (currentText !== originalText) {
                showSaveButton(textDiv.dataset.contentId, textDiv);
            }
        });
    }
    
    container.appendChild(textDiv);
    
    // Images
    if (content.images && content.images.length > 0) {
        const imagesDiv = document.createElement('div');
        imagesDiv.className = 'content-images-display';
        
        content.images.forEach(image => {
            const wrapper = document.createElement('div');
            wrapper.className = 'image-wrapper';
            
            const img = document.createElement('img');
            const imageSrc = `/uploads/${image.storedName || image.filename}`;
            img.src = imageSrc;
            img.alt = image.originalName || image.filename;
            img.onclick = () => openLightbox(imageSrc);
            
            wrapper.appendChild(img);
            
            if (isAdmin) {
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'image-delete-btn';
                deleteBtn.innerHTML = '×';
                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    handleDeleteImage(content._id || content.id, image);
                };
                wrapper.appendChild(deleteBtn);
            }
            
            imagesDiv.appendChild(wrapper);
        });
        
        container.appendChild(imagesDiv);
    }
    
    // Add drop zone for admin
    if (isAdmin) {
        const dropZone = createDropZone(content._id || content.id);
        container.appendChild(dropZone);
    }
    
    tabContent.appendChild(container);
}

// Create Drop Zone
function createDropZone(contentId) {
    const dropZone = document.createElement('div');
    dropZone.className = 'drop-zone';
    dropZone.innerHTML = `
        <div class="drop-zone-icon">📁</div>
        <div class="drop-zone-text">Drag & Drop Images Here</div>
        <div class="drop-zone-hint">or click to browse (max 5MB per image)</div>
    `;
    
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.multiple = true;
    fileInput.style.display = 'none';
    
    dropZone.appendChild(fileInput);
    
    dropZone.onclick = () => fileInput.click();
    
    fileInput.addEventListener('change', (e) => {
        handleFileUpload(contentId, e.target.files);
    });
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        handleFileUpload(contentId, e.dataTransfer.files);
    });
    
    return dropZone;
}

// Handle File Upload
async function handleFileUpload(contentId, files) {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
        showMessage('Please select image files', 'error');
        return;
    }
    
    for (const file of imageFiles) {
        if (file.size > 5 * 1024 * 1024) {
            showMessage(`${file.name} is too large (max 5MB)`, 'error');
            return;
        }
    }
    
    try {
        showLoading(true);
        
        const formData = new FormData();
        imageFiles.forEach(file => formData.append('images', file));
        
        const token = userToken || sessionStorage.getItem(`token:${currentSpace}`);
        const response = await fetch(`${API_BASE}/spaces/${encodeURIComponent(currentSpace)}/content/${contentId}/images`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showMessage('Images uploaded successfully!', 'success');
            await loadSpace(currentSpace);
        } else {
            showMessage(result.error || 'Failed to upload images', 'error');
        }
    } catch (error) {
        console.error('Upload error:', error);
        showMessage('Failed to upload images', 'error');
    } finally {
        showLoading(false);
    }
}

// Show Save Button
function showSaveButton(contentId, textDiv) {
    let actionsDiv = tabContent.querySelector('.content-actions');
    
    if (!actionsDiv) {
        actionsDiv = document.createElement('div');
        actionsDiv.className = 'content-actions';
        
        const saveBtn = document.createElement('button');
        saveBtn.className = 'btn-save';
        saveBtn.textContent = 'Save Changes';
        saveBtn.onclick = () => handleSaveText(contentId, textDiv);
        
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn-cancel';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => {
            textDiv.textContent = textDiv.dataset.originalText;
            actionsDiv.remove();
        };
        
        actionsDiv.appendChild(saveBtn);
        actionsDiv.appendChild(cancelBtn);
        
        tabContent.querySelector('.content-display').appendChild(actionsDiv);
    }
}

// Handle Save Text
async function handleSaveText(contentId, textDiv) {
    const newText = textDiv.textContent.trim();
    
    console.log('Saving text:', { contentId, newText, currentSpace });
    
    if (!contentId) {
        showMessage('Error: Content ID is missing', 'error');
        console.error('Content ID is missing');
        return;
    }
    
    try {
        showLoading(true);
        
        const token = userToken || sessionStorage.getItem(`token:${currentSpace}`);
        
        if (!token) {
            showMessage('Please login to save changes', 'error');
            return;
        }
        
        console.log('Sending PUT request to:', `${API_BASE}/spaces/${encodeURIComponent(currentSpace)}/content/${contentId}`);
        
        const response = await fetch(`${API_BASE}/spaces/${encodeURIComponent(currentSpace)}/content/${contentId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ text: newText })
        });
        
        const result = await response.json();
        console.log('Save response:', { status: response.status, result });
        
        if (response.ok) {
            showMessage('Content updated!', 'success');
            textDiv.dataset.originalText = newText;
            const actionsDiv = tabContent.querySelector('.content-actions');
            if (actionsDiv) actionsDiv.remove();
            
            // Reload space but keep the same tab active
            const currentTab = activeTabIndex;
            await loadSpace(currentSpace);
            if (currentTab < allContents.length) {
                showTab(currentTab);
            }
        } else {
            showMessage(result.error || 'Failed to update', 'error');
            console.error('Save failed:', result);
        }
    } catch (error) {
        console.error('Save error:', error);
        showMessage('Failed to save changes: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Handle Delete Image
async function handleDeleteImage(contentId, image) {
    if (!confirm('Delete this image?')) return;
    
    try {
        showLoading(true);
        
        const token = userToken || sessionStorage.getItem(`token:${currentSpace}`);
        const response = await fetch(`${API_BASE}/spaces/${encodeURIComponent(currentSpace)}/content/${contentId}/images/${image.storedName || image.filename}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showMessage('Image deleted!', 'success');
            await loadSpace(currentSpace);
        } else {
            showMessage(result.error || 'Failed to delete image', 'error');
        }
    } catch (error) {
        console.error('Delete error:', error);
        showMessage('Failed to delete image', 'error');
    } finally {
        showLoading(false);
    }
}

// Handle Add New Tab
async function handleAddNewTab() {
    try {
        showLoading(true);
        
        const token = userToken || sessionStorage.getItem(`token:${currentSpace}`);
        const response = await fetch(`${API_BASE}/spaces/${encodeURIComponent(currentSpace)}/content`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ text: 'New tab content...' })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showMessage('New tab created!', 'success');
            await loadSpace(currentSpace);
            activeTabIndex = allContents.length - 1;
        } else {
            showMessage(result.error || 'Failed to create tab', 'error');
        }
    } catch (error) {
        console.error('Add tab error:', error);
        showMessage('Failed to create tab', 'error');
    } finally {
        showLoading(false);
    }
}

// Handle Delete Tab
async function handleDeleteTab(index) {
    if (!confirm('Delete this tab?')) return;
    
    const content = allContents[index];
    
    try {
        showLoading(true);
        
        const token = userToken || sessionStorage.getItem(`token:${currentSpace}`);
        const response = await fetch(`${API_BASE}/spaces/${encodeURIComponent(currentSpace)}/content/${content._id || content.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showMessage('Tab deleted!', 'success');
            await loadSpace(currentSpace);
            if (activeTabIndex >= allContents.length) {
                activeTabIndex = Math.max(0, allContents.length - 1);
            }
        } else {
            showMessage(result.error || 'Failed to delete tab', 'error');
        }
    } catch (error) {
        console.error('Delete error:', error);
        showMessage('Failed to delete tab', 'error');
    } finally {
        showLoading(false);
    }
}

// Show Empty State
function showEmptyState() {
    tabContent.innerHTML = `
        <div class="empty-tab-message">
            <h3>No Content Yet</h3>
            <p>${userRole === 'admin' ? 'Click "+ New Tab" to add your first content' : 'This space is empty'}</p>
        </div>
    `;
}

// Lightbox Functions
function openLightbox(src) {
    lightboxImage.src = src;
    imageLightbox.style.display = 'flex';
}

function closeLightboxModal() {
    imageLightbox.style.display = 'none';
    lightboxImage.src = '';
}

// UI Functions
function closePasswordOverlay() {
    passwordOverlay.style.display = 'none';
    passwordContent.innerHTML = '';
}

function showSpaceViewer() {
    homePage.style.display = 'none';
    spaceViewer.style.display = 'block';
}

function showHomePage() {
    spaceViewer.style.display = 'none';
    homePage.style.display = 'flex';
    currentSpace = null;
    userToken = null;
    userRole = null;
    allContents = [];
    activeTabIndex = 0;
    spaceNameInput.value = '';
}

function showLoading(show) {
    loading.style.display = show ? 'flex' : 'none';
}

function showMessage(text, type = 'info') {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${type}`;
    messageEl.textContent = text;
    messages.appendChild(messageEl);
    setTimeout(() => {
        if (messageEl.parentNode) messageEl.parentNode.removeChild(messageEl);
    }, 5000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
