const API_BASE = 'http://localhost:3000/api';

// Global State
let currentSpace = null;
let userToken = null;
let userRole = null;

// Modal state
let _editingContentId = null;
let _deletingContentId = null;

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

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    goButton.addEventListener('click', handleGo);
    spaceNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleGo();
    });
    closePasswordModal.addEventListener('click', closePasswordOverlay);
    backButton.addEventListener('click', showHomePage);
    
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
    
    // Validate space name
    if (!/^[a-zA-Z0-9-_]{3,40}$/.test(spaceName)) {
        showMessage('Space name must be 3-40 characters (letters, numbers, hyphens, underscores)', 'error');
        return;
    }
    
    currentSpace = spaceName;
    
    try {
        showLoading(true);
        
        // Check if space exists
        const response = await fetch(`${API_BASE}/spaces/${encodeURIComponent(spaceName)}/exists`);
        const result = await response.json();
        
        if (result.exists) {
            // Space exists - show single password input
            showExistingSpacePasswordForm(spaceName);
        } else {
            // Space doesn't exist - show create form with two passwords
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
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            userToken = result.token;
            userRole = result.role;
            
            // Save to session storage
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
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: currentSpace,
                viewPassword,
                adminPassword
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showMessage('Space created successfully!', 'success');
            // Automatically login with admin password
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

// Display Space
function displaySpace(space, pagination) {
    document.getElementById('spaceTitle').textContent = space.name;
    
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
        contentContainer.innerHTML = '<div class="content-item"><p class="empty-message">No content yet. Admin can add content below.</p></div>';
    }
    
    // Update admin status display
    const adminStatus = document.getElementById('adminStatus');
    const role = userRole || sessionStorage.getItem(`role:${space.name}`);
    if (role === 'admin') {
        adminStatus.innerHTML = '🔓 Logged in as <strong>Admin</strong>';
        adminStatus.style.color = '#fff';
        document.getElementById('adminActions').style.display = 'block';
        
        // Setup add content form
        const addContentForm = document.getElementById('addContentForm');
        if (addContentForm && !addContentForm.dataset.listenerAdded) {
            addContentForm.addEventListener('submit', handleAddContent);
            addContentForm.dataset.listenerAdded = 'true';
        }
        
        // Setup image preview
        const contentImages = document.getElementById('contentImages');
        if (contentImages && !contentImages.dataset.listenerAdded) {
            contentImages.addEventListener('change', handleImagePreview);
            contentImages.dataset.listenerAdded = 'true';
        }
    } else if (role === 'viewer') {
        adminStatus.innerHTML = '👁️ <strong>Viewer</strong> (read-only)';
        adminStatus.style.color = '#fff';
        document.getElementById('adminActions').style.display = 'none';
    } else {
        adminStatus.innerHTML = '🔒 Not logged in';
        adminStatus.style.color = '#fff';
        document.getElementById('adminActions').style.display = 'none';
    }
}

// Create Content Element
function createContentElement(content, isAdmin) {
    const div = document.createElement('div');
    div.className = 'content-item';
    
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

// Handle Add Content
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
            document.getElementById('imagePreview').innerHTML = '';
            await loadSpace(currentSpace);
        } else {
            if (response.status === 401 || response.status === 403) {
                userToken = null;
                userRole = null;
                sessionStorage.removeItem(`token:${currentSpace}`);
                sessionStorage.removeItem(`role:${currentSpace}`);
                document.getElementById('adminActions').style.display = 'none';
                document.getElementById('adminStatus').innerHTML = '🔒 Not logged in';
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

// Handle image preview
function handleImagePreview(e) {
    const preview = document.getElementById('imagePreview');
    preview.innerHTML = '';
    
    const files = Array.from(e.target.files);
    files.forEach(file => {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = document.createElement('img');
                img.src = ev.target.result;
                preview.appendChild(img);
            };
            reader.readAsDataURL(file);
        }
    });
}

// Edit Modal
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

// Delete Modal
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

// Modal functions
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

function openImageModal(src) {
    document.getElementById('modalImage').src = src;
    openModal('imageModal');
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
    
    // Clear user state
    currentSpace = null;
    userToken = null;
    userRole = null;
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
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (messageEl.parentNode) {
            messageEl.parentNode.removeChild(messageEl);
        }
    }, 5000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
