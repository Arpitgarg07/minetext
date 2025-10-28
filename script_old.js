// API Configuration
const API_BASE = window.location.origin + '/api';

// Global state
let currentSpace = null;
let userToken = null;
let userRole = null; // 'viewer' or 'admin'

// DOM Elements
const createSection = document.getElementById('createSection');
const openSection = document.getElementById('openSection');
const spaceViewer = document.getElementById('spaceViewer');
const loading = document.getElementById('loading');
const messages = document.getElementById('messages');

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
});

function setupEventListeners() {
    // Create Space Form
    document.getElementById('createSpaceForm').addEventListener('submit', handleCreateSpace);
    
    // Open Space Form
    document.getElementById('openSpaceForm').addEventListener('submit', handleOpenSpace);
    
    // Back button
    document.getElementById('backBtn').addEventListener('click', showHomePage);
    
    // Add content form
    document.getElementById('addContentForm').addEventListener('submit', handleAddContent);
    
    // Image preview for add content
    const imgInput = document.getElementById('contentImages');
    if (imgInput) imgInput.addEventListener('change', handleImagePreview);

    // Edit / Delete modal buttons
    const saveEditBtn = document.getElementById('saveEditBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    if (saveEditBtn) saveEditBtn.addEventListener('click', saveEditHandler);
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', () => closeModal('editModal'));
    if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', confirmDeleteHandler);
    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', () => closeModal('confirmDeleteModal'));
}

// Create Space Handler
async function handleCreateSpace(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {
        name: formData.get('name').trim(),
        viewPassword: formData.get('viewPassword'),
        adminPassword: formData.get('adminPassword')
    };
    
    // Client-side validation
    if (!validateSpaceName(data.name)) {
        showMessage('Space name must be 3-40 characters, letters, numbers, hyphens and underscores only', 'error');
        return;
    }
    
    if (data.viewPassword.length < 6) {
        showMessage('View password must be at least 6 characters', 'error');
        return;
    }
    
    if (data.adminPassword.length < 6) {
        showMessage('Admin password must be at least 6 characters', 'error');
        return;
    }
    
    try {
        showLoading(true);
        
        const response = await fetch(`${API_BASE}/spaces`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showMessage(`Space "${data.name}" created successfully! You can now open it with either password.`, 'success');
            e.target.reset();
        } else {
            showMessage(result.error || 'Failed to create space', 'error');
        }
    } catch (error) {
        console.error('Create space error:', error);
        showMessage('Network error. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
}

// Open Space Handler
async function handleOpenSpace(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const spaceName = formData.get('name').trim();
    const password = formData.get('password');
    
    if (!spaceName || !password) {
        showMessage('Please enter space name and password', 'error');
        return;
    }
    
    await loginAndLoadSpace(spaceName, password);
}

// Login and Load Space
async function loginAndLoadSpace(spaceName, password) {
    try {
        showLoading(true);
        
        // First, login to get token and role
        const loginResponse = await fetch(`${API_BASE}/spaces/${encodeURIComponent(spaceName)}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password })
        });
        
        const loginResult = await loginResponse.json();
        
        if (!loginResponse.ok) {
            showMessage(loginResult.error || 'Invalid password', 'error');
            showLoading(false);
            return;
        }
        
        // Store token and role
        userToken = loginResult.token;
        userRole = loginResult.role;
        currentSpace = spaceName;
        sessionStorage.setItem(`token:${spaceName}`, userToken);
        sessionStorage.setItem(`role:${spaceName}`, userRole);
        
        // Now load the space content
        await loadSpace(spaceName);
        
        showLoading(false);
    } catch (error) {
        console.error('Login error:', error);
        showMessage('Failed to access space', 'error');
        showLoading(false);
    }
}

// Load Space Content
async function loadSpace(spaceName) {
    try {
        showLoading(true);
        currentSpace = spaceName;
        
        const token = userToken || sessionStorage.getItem(`token:${spaceName}`);
        if (!token) {
            showMessage('Please login to view this space', 'error');
            showLoading(false);
            return;
        }
        
        const response = await fetch(`${API_BASE}/spaces/${encodeURIComponent(spaceName)}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const result = await response.json();
        
        if (response.ok) {
            displaySpace(result.space, result.pagination);
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

// Display Space Content
function displaySpace(space, pagination) {
    document.getElementById('spaceTitle').textContent = `Space: ${space.name}`;
    
    const contentContainer = document.getElementById('spaceContent');
    contentContainer.innerHTML = '';
    
    if (space.contents && space.contents.length > 0) {
        // Get current user role
        const role = userRole || sessionStorage.getItem(`role:${space.name}`);
        const isAdmin = role === 'admin';
        
        space.contents.forEach(content => {
            const contentEl = createContentElement(content, isAdmin);
            contentContainer.appendChild(contentEl);
        });
    } else {
        contentContainer.innerHTML = '<div class="content-item"><p>No content yet. Admin can add content below.</p></div>';
    }
    
    // Update admin status display
    const adminStatus = document.getElementById('adminStatus');
    const role = userRole || sessionStorage.getItem(`role:${space.name}`);
    if (role === 'admin') {
        adminStatus.innerHTML = '🔓 Logged in as <strong>Admin</strong>';
        adminStatus.style.color = '#4CAF50';
        document.getElementById('adminActions').style.display = 'block';
    } else if (role === 'viewer') {
        adminStatus.innerHTML = '👁️ Logged in as <strong>Viewer</strong> (read-only)';
        adminStatus.style.color = '#2196F3';
        document.getElementById('adminActions').style.display = 'none';
    } else {
        adminStatus.innerHTML = '🔒 Not logged in';
        adminStatus.style.color = '#666';
        document.getElementById('adminActions').style.display = 'none';
    }
}

// Create Content Element
function createContentElement(content, isAdmin = false) {
    const div = document.createElement('div');
    div.className = 'content-item';
    div.dataset.contentId = content._id || content.id;

    let html = '';

    if (content.text) {
        html += `<div class="content-text">${escapeHtml(content.text)}</div>`;
    }

    if (content.images && content.images.length > 0) {
        html += '<div class="content-images">';
        content.images.forEach(image => {
            const imageSrc = `/uploads/${image.storedName || image.filename}`;
            html += `<img src="${imageSrc}" alt="${escapeHtml(image.originalName || image.filename)}" onclick="openImageModal('${imageSrc}')">`;
        });
        html += '</div>';
    }

    const createdAt = new Date(content.createdAt).toLocaleString();
    html += `<div class="content-meta">Posted on ${createdAt}</div>`;

    div.innerHTML = html;

    // Admin controls (edit/delete)
    if (isAdmin) {
        const controls = document.createElement('div');
        controls.className = 'content-controls';

        const editBtn = document.createElement('button');
        editBtn.className = 'btn-edit';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => openEditModal(content));

        const delBtn = document.createElement('button');
        delBtn.className = 'btn-delete';
        delBtn.textContent = 'Delete';
        delBtn.addEventListener('click', () => openConfirmDelete(content));

        controls.appendChild(editBtn);
        controls.appendChild(delBtn);
        div.appendChild(controls);
    }

    return div;
}

// Add Content Handler
async function handleAddContent(e) {
    e.preventDefault();
    
    // Check if user has admin role
    const token = userToken || sessionStorage.getItem(`token:${currentSpace}`);
    const role = userRole || sessionStorage.getItem(`role:${currentSpace}`);
    
    if (!token || role !== 'admin') {
        showMessage('You must login as admin to add content', 'error');
        document.getElementById('adminActions').style.display = 'none';
        return;
    }
    
    const formData = new FormData(e.target);
    const text = formData.get('text').trim();
    const images = formData.getAll('images').filter(file => file.size > 0);
    
    if (!text && images.length === 0) {
        showMessage('Please enter text or select images', 'error');
        return;
    }
    
    // Check file sizes
    for (const file of images) {
        if (file.size > 5 * 1024 * 1024) {
            showMessage(`File "${file.name}" is too large. Maximum size is 5MB.`, 'error');
            return;
        }
    }
    
    try {
        showLoading(true);
        
        const response = await fetch(`${API_BASE}/spaces/${encodeURIComponent(currentSpace)}/content`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showMessage('Content added successfully!', 'success');
            e.target.reset();
            await loadSpace(currentSpace); // Refresh content
        } else {
            if (response.status === 401 || response.status === 403) {
                userToken = null;
                userRole = null;
                sessionStorage.removeItem(`token:${currentSpace}`);
                sessionStorage.removeItem(`role:${currentSpace}`);
                document.getElementById('adminActions').style.display = 'none';
                document.getElementById('adminStatus').innerHTML = '🔒 Not logged in';
                document.getElementById('adminStatus').style.color = '#dc3545';
                showMessage('Session expired or unauthorized. Please login again.', 'error');
            } else {
                showMessage(result.error || 'Failed to add content', 'error');
            }
        }
    } catch (error) {
        console.error('Add content error:', error);
        showMessage('Failed to add content', 'error');
    } finally {
        showLoading(false);
    }
}

// UI Helper Functions
function showHomePage() {
    spaceViewer.style.display = 'none';
    createSection.style.display = 'block';
    openSection.style.display = 'block';
    
    // Clear user state
    currentSpace = null;
    userToken = null;
    userRole = null;
}

function showSpaceViewer() {
    createSection.style.display = 'none';
    openSection.style.display = 'none';
    spaceViewer.style.display = 'block';
    
    // Check for existing token and role
    const savedToken = sessionStorage.getItem(`token:${currentSpace}`);
    const savedRole = sessionStorage.getItem(`role:${currentSpace}`);
    
    if (savedToken && savedRole) {
        userToken = savedToken;
        userRole = savedRole;
        
        if (savedRole === 'admin') {
            document.getElementById('adminActions').style.display = 'block';
            document.getElementById('adminStatus').innerHTML = '� Logged in as <strong>Admin</strong>';
            document.getElementById('adminStatus').style.color = '#4CAF50';
        } else if (savedRole === 'viewer') {
            document.getElementById('adminActions').style.display = 'none';
            document.getElementById('adminStatus').innerHTML = '👁️ Logged in as <strong>Viewer</strong> (read-only)';
            document.getElementById('adminStatus').style.color = '#2196F3';
        }
    } else {
        userToken = null;
        userRole = null;
        document.getElementById('adminActions').style.display = 'none';
        document.getElementById('adminStatus').innerHTML = '🔒 Not logged in';
        document.getElementById('adminStatus').style.color = '#666';
    }
}

function showLoading(show) {
    loading.style.display = show ? 'flex' : 'none';
}

function showMessage(text, type = 'info') {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${type}`;
    messageEl.textContent = text;
    
    messages.appendChild(messageEl);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (messageEl.parentNode) {
            messageEl.parentNode.removeChild(messageEl);
        }
    }, 5000);
    
    // Allow manual removal on click
    messageEl.addEventListener('click', () => {
        if (messageEl.parentNode) {
            messageEl.parentNode.removeChild(messageEl);
        }
    });
}

function validateSpaceName(name) {
    return /^[a-zA-Z0-9-_]{3,40}$/.test(name);
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function openImageModal(src) {
    // Simple image modal - you can enhance this
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 2000;
        cursor: pointer;
    `;
    
    const img = document.createElement('img');
    img.src = src;
    img.style.cssText = `
        max-width: 90%;
        max-height: 90%;
        border-radius: 8px;
    `;
    
    modal.appendChild(img);
    document.body.appendChild(modal);
    
    modal.addEventListener('click', () => {
        document.body.removeChild(modal);
    });
}

// Image preview handler for add content form
function handleImagePreview(e) {
    const files = Array.from(e.target.files || []);
    const preview = document.getElementById('imagePreview');
    preview.innerHTML = '';
    files.slice(0,6).forEach((file, idx) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const thumb = document.createElement('div');
            thumb.className = 'thumb';
            const img = document.createElement('img');
            img.src = ev.target.result;
            const remove = document.createElement('button');
            remove.className = 'remove';
            remove.type = 'button';
            remove.textContent = '✕';
            remove.addEventListener('click', () => removePreviewFile(idx));
            thumb.appendChild(img);
            thumb.appendChild(remove);
            preview.appendChild(thumb);
        };
        reader.readAsDataURL(file);
    });
}

// Remove a file from the file input by index (rebuild FileList)
function removePreviewFile(indexToRemove) {
    const input = document.getElementById('contentImages');
    const dt = new DataTransfer();
    const files = Array.from(input.files || []);
    files.forEach((f, i) => { if (i !== indexToRemove) dt.items.add(f); });
    input.files = dt.files;
    // trigger preview update
    handleImagePreview({ target: input });
}

// Edit / Delete flow
let _editingContentId = null;
let _deletingContentId = null;

function openEditModal(content) {
    _editingContentId = content._id || content.id;
    document.getElementById('editContentText').value = content.text || '';
    openModal('editModal');
}

function saveEditHandler() {
    const newText = document.getElementById('editContentText').value.trim();
    if (!_editingContentId) return;
    const token = userToken || sessionStorage.getItem(`token:${currentSpace}`);
    const role = userRole || sessionStorage.getItem(`role:${currentSpace}`);
    if (!token || role !== 'admin') { showMessage('Please login as admin', 'error'); closeModal('editModal'); return; }
    fetch(`${API_BASE}/spaces/${encodeURIComponent(currentSpace)}/content/${_editingContentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ text: newText })
    }).then(async res => {
        const j = await res.json().catch(()=>({}));
        if (res.ok) {
            showMessage('Content updated', 'success');
            closeModal('editModal');
            await loadSpace(currentSpace);
        } else {
            showMessage(j.error || 'Update failed', 'error');
        }
    }).catch(err => { console.error(err); showMessage('Update failed', 'error'); });
}

function openConfirmDelete(content) {
    _deletingContentId = content._id || content.id;
    openModal('confirmDeleteModal');
}

async function confirmDeleteHandler() {
    if (!_deletingContentId) return;
    const token = userToken || sessionStorage.getItem(`token:${currentSpace}`);
    const role = userRole || sessionStorage.getItem(`role:${currentSpace}`);
    if (!token || role !== 'admin') { showMessage('Please login as admin', 'error'); closeModal('confirmDeleteModal'); return; }
    try {
        const res = await fetch(`${API_BASE}/spaces/${encodeURIComponent(currentSpace)}/content/${_deletingContentId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const j = await res.json().catch(()=>({}));
        if (res.ok) {
            showMessage('Content deleted', 'success');
            closeModal('confirmDeleteModal');
            await loadSpace(currentSpace);
        } else {
            showMessage(j.error || 'Delete failed', 'error');
        }
    } catch (err) {
        console.error(err);
        showMessage('Delete failed', 'error');
    }
}

function openModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.setAttribute('aria-hidden','false');
}

function closeModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.setAttribute('aria-hidden','true');
}
