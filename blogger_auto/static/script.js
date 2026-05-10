/**
 * BlogBot - 블로그스팟 자동 포스팅 프론트엔드
 */

// ==================== 상태 관리 ====================
let state = {
    authenticated: false,
    selectedBlog: null,
    blogs: [],
    posts: [],
    trends: []
};

// ==================== 초기화 ====================
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    checkAuthStatus();
    loadDashboardTrends();
    setupDragDrop();
});

// ==================== 탭 네비게이션 ====================
function initTabs() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            switchTab(tab);
        });
    });
}

function switchTab(tabName) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    const btn = document.querySelector(`[data-tab="${tabName}"]`);
    const tab = document.getElementById(`tab-${tabName}`);
    if (btn) btn.classList.add('active');
    if (tab) tab.classList.add('active');
    const titles = { dashboard: '대시보드', trends: '트렌드', write: '글 작성', posts: '게시물 관리', bulk: '대량 포스팅' };
    document.getElementById('page-title').textContent = titles[tabName] || tabName;
    if (tabName === 'trends') loadTrends();
    if (tabName === 'posts') loadPosts();
}

// ==================== 사이드바 토글 ====================
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// ==================== 인증 ====================
async function checkAuthStatus() {
    try {
        const res = await fetch('/api/auth/status');
        const data = await res.json();
        state.authenticated = data.authenticated;
        updateAuthUI();
        if (state.authenticated) loadBlogs();
    } catch (e) {
        console.error('Auth check failed:', e);
    }
}

function updateAuthUI() {
    const statusEl = document.getElementById('auth-status');
    const btnEl = document.getElementById('btn-login');
    if (state.authenticated) {
        statusEl.innerHTML = '<span class="status-dot online"></span><span>연결됨</span>';
        btnEl.textContent = '🚪 로그아웃';
        btnEl.onclick = handleLogout;
        btnEl.className = 'btn btn-secondary btn-full';
    } else {
        statusEl.innerHTML = '<span class="status-dot offline"></span><span>미연결</span>';
        btnEl.innerHTML = '<span>🔑</span> Google 로그인';
        btnEl.onclick = handleLogin;
        btnEl.className = 'btn btn-login';
    }
}

async function handleLogin() {
    showToast('info', '브라우저에서 Google 로그인 창이 열립니다...');
    try {
        const res = await fetch('/api/auth/login', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            state.authenticated = true;
            updateAuthUI();
            loadBlogs();
            showToast('success', '로그인 성공!');
        } else {
            showToast('error', '로그인 실패: ' + data.error);
        }
    } catch (e) {
        showToast('error', '로그인 중 오류가 발생했습니다.');
    }
}

async function handleLogout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        state.authenticated = false;
        state.blogs = [];
        state.selectedBlog = null;
        updateAuthUI();
        document.getElementById('blog-select').innerHTML = '<option value="">블로그를 선택하세요</option>';
        showToast('info', '로그아웃 되었습니다.');
    } catch (e) {
        showToast('error', '로그아웃 실패');
    }
}

// ==================== 블로그 ====================
async function loadBlogs() {
    try {
        const res = await fetch('/api/blogs');
        const data = await res.json();
        if (data.success) {
            state.blogs = data.blogs;
            const select = document.getElementById('blog-select');
            select.innerHTML = '<option value="">블로그를 선택하세요</option>';
            data.blogs.forEach(blog => {
                select.innerHTML += `<option value="${blog.id}">${blog.name} (${blog.posts_count}개)</option>`;
            });
            document.getElementById('stat-blogs').textContent = data.blogs.length;
            if (data.blogs.length === 1) {
                select.value = data.blogs[0].id;
                onBlogChange();
            }
        }
    } catch (e) {
        showToast('error', '블로그 목록을 불러올 수 없습니다.');
    }
}

function onBlogChange() {
    const select = document.getElementById('blog-select');
    state.selectedBlog = select.value || null;
    if (state.selectedBlog) loadPosts();
}

// ==================== 게시물 ====================
async function loadPosts() {
    if (!state.selectedBlog) {
        document.getElementById('posts-container').innerHTML = '<div class="empty-state"><p>블로그를 먼저 선택하세요</p></div>';
        return;
    }
    document.getElementById('posts-container').innerHTML = '<div class="loading-state"><div class="spinner"></div><p>게시물을 불러오는 중...</p></div>';
    try {
        const res = await fetch(`/api/blogs/${state.selectedBlog}/posts?max=30`);
        const data = await res.json();
        if (data.success) {
            state.posts = data.posts;
            document.getElementById('stat-posts').textContent = data.posts.length;
            renderPosts(data.posts);
            renderDashboardPosts(data.posts.slice(0, 5));
        }
    } catch (e) {
        document.getElementById('posts-container').innerHTML = '<div class="empty-state"><p>게시물을 불러올 수 없습니다.</p></div>';
    }
}

function renderPosts(posts) {
    const container = document.getElementById('posts-container');
    if (!posts.length) {
        container.innerHTML = '<div class="empty-state"><p>게시물이 없습니다.</p></div>';
        return;
    }
    container.innerHTML = posts.map(post => `
        <div class="post-item">
            <div class="post-item-info">
                <h4>${escapeHtml(post.title)}</h4>
                <p>${new Date(post.published).toLocaleDateString('ko-KR')} · ${(post.labels || []).join(', ') || '라벨 없음'}</p>
            </div>
            <div class="post-item-actions">
                <a href="${post.url}" target="_blank" class="btn btn-sm btn-secondary">🔗 보기</a>
                <button class="btn btn-sm btn-danger" onclick="deletePostConfirm('${post.id}', '${escapeHtml(post.title)}')">🗑️</button>
            </div>
        </div>
    `).join('');
}

function renderDashboardPosts(posts) {
    const el = document.getElementById('dashboard-posts');
    if (!posts.length) {
        el.innerHTML = '<li class="empty-state">게시물이 없습니다</li>';
        return;
    }
    el.innerHTML = posts.map(post => `
        <li><span class="trend-title">${escapeHtml(post.title)}</span><span class="trend-traffic">${new Date(post.published).toLocaleDateString('ko-KR')}</span></li>
    `).join('');
}

async function deletePostConfirm(postId, title) {
    if (!confirm(`"${title}" 게시물을 삭제하시겠습니까?`)) return;
    try {
        const res = await fetch(`/api/blogs/${state.selectedBlog}/posts/${postId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showToast('success', '게시물이 삭제되었습니다.');
            loadPosts();
        } else {
            showToast('error', '삭제 실패: ' + data.error);
        }
    } catch (e) {
        showToast('error', '삭제 중 오류가 발생했습니다.');
    }
}

// ==================== 글 작성 ====================
function insertTag(tag) {
    const textarea = document.getElementById('post-content');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end);
    let insert = '';
    if (tag === 'a') {
        const url = prompt('URL을 입력하세요:', 'https://');
        if (!url) return;
        insert = `<a href="${url}">${selected || '링크 텍스트'}</a>`;
    } else if (tag === 'img') {
        const url = prompt('이미지 URL을 입력하세요:', 'https://');
        if (!url) return;
        insert = `<img src="${url}" alt="${selected || '이미지'}">`;
    } else {
        insert = `<${tag}>${selected || ''}</${tag}>`;
    }
    textarea.value = textarea.value.substring(0, start) + insert + textarea.value.substring(end);
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = start + insert.length;
}

function previewPost() {
    const title = document.getElementById('post-title').value;
    const content = document.getElementById('post-content').value;
    if (!title && !content) { showToast('error', '제목이나 내용을 입력하세요.'); return; }
    document.getElementById('preview-title').textContent = title;
    document.getElementById('preview-content').innerHTML = content;
    document.getElementById('preview-modal').classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

async function submitPost() {
    if (!state.selectedBlog) { showToast('error', '블로그를 먼저 선택하세요.'); return; }
    const title = document.getElementById('post-title').value.trim();
    const content = document.getElementById('post-content').value.trim();
    const labelsStr = document.getElementById('post-labels').value.trim();
    const isDraft = document.getElementById('post-draft').checked;
    if (!title || !content) { showToast('error', '제목과 내용을 모두 입력하세요.'); return; }
    const labels = labelsStr ? labelsStr.split(',').map(l => l.trim()).filter(Boolean) : [];
    try {
        const res = await fetch(`/api/blogs/${state.selectedBlog}/posts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content, labels, is_draft: isDraft })
        });
        const data = await res.json();
        if (data.success) {
            showToast('success', `게시물이 ${isDraft ? '임시저장' : '발행'}되었습니다!`);
            document.getElementById('post-title').value = '';
            document.getElementById('post-content').value = '';
            document.getElementById('post-labels').value = '';
            loadPosts();
        } else {
            showToast('error', '발행 실패: ' + data.error);
        }
    } catch (e) {
        showToast('error', '발행 중 오류가 발생했습니다.');
    }
}

// ==================== 트렌드 ====================
async function loadTrends() {
    const geo = document.getElementById('country-select').value;
    const container = document.getElementById('trends-container');
    container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>트렌드를 불러오는 중...</p></div>';
    try {
        const res = await fetch(`/api/trends?geo=${geo}&limit=20`);
        const data = await res.json();
        if (data.success) {
            state.trends = data.trends;
            document.getElementById('stat-trends').textContent = data.trends.length;
            renderTrends(data.trends);
        } else {
            container.innerHTML = `<div class="empty-state"><p>트렌드를 불러올 수 없습니다: ${data.error}</p></div>`;
        }
    } catch (e) {
        container.innerHTML = '<div class="empty-state"><p>트렌드를 불러올 수 없습니다.</p></div>';
    }
}

function renderTrends(trends) {
    const container = document.getElementById('trends-container');
    if (!trends.length) {
        container.innerHTML = '<div class="empty-state"><p>트렌드 데이터가 없습니다.</p></div>';
        return;
    }
    container.innerHTML = trends.map((trend, i) => `
        <div class="trend-card">
            <div class="trend-card-header">
                <div class="trend-card-rank">${i + 1}</div>
                <div class="trend-card-title">${escapeHtml(trend.title)}</div>
                ${trend.traffic ? `<div class="trend-card-traffic">${escapeHtml(trend.traffic)}+</div>` : ''}
            </div>
            ${trend.description ? `<div class="trend-card-desc">${escapeHtml(trend.description).substring(0, 120)}</div>` : ''}
            <div class="trend-card-actions">
                <button class="btn btn-sm btn-primary" style="background: linear-gradient(135deg, #00cec9, #0984e3);" onclick="aiAutoPost('${escapeHtml(trend.title)}')">🤖 AI 자동 발행</button>
                <button class="btn btn-sm btn-secondary" onclick="useTrendForPost('${escapeHtml(trend.title)}')">✍️ 직접 작성</button>
                ${trend.link ? `<a href="${trend.link}" target="_blank" class="btn btn-sm btn-secondary">🔗</a>` : ''}
            </div>
        </div>
    `).join('');
}

async function loadDashboardTrends() {
    try {
        const res = await fetch('/api/trends?geo=KR&limit=8');
        const data = await res.json();
        if (data.success && data.trends.length) {
            document.getElementById('stat-trends').textContent = data.trends.length;
            const el = document.getElementById('dashboard-trends');
            el.innerHTML = data.trends.slice(0, 8).map((t, i) => `
                <li>
                    <span class="trend-rank">${i + 1}</span>
                    <span class="trend-title">${escapeHtml(t.title)}</span>
                    ${t.traffic ? `<span class="trend-traffic">${t.traffic}+</span>` : ''}
                </li>
            `).join('');
        }
    } catch (e) {
        document.getElementById('dashboard-trends').innerHTML = '<li class="empty-state">트렌드를 불러올 수 없습니다</li>';
    }
}

function useTrendForPost(keyword) {
    document.getElementById('post-title').value = keyword;
    document.getElementById('post-labels').value = keyword;
    switchTab('write');
    showToast('info', `"${keyword}" 키워드로 글 작성을 시작하세요!`);
}

// ==================== 대량 포스팅 ====================
function setupDragDrop() {
    const area = document.getElementById('upload-area');
    if (!area) return;
    area.addEventListener('dragover', (e) => { e.preventDefault(); area.style.borderColor = 'var(--accent)'; });
    area.addEventListener('dragleave', () => { area.style.borderColor = ''; });
    area.addEventListener('drop', (e) => {
        e.preventDefault(); area.style.borderColor = '';
        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.csv')) {
            document.getElementById('csv-file').files = e.dataTransfer.files;
            handleFileSelect();
        } else {
            showToast('error', 'CSV 파일만 업로드 가능합니다.');
        }
    });
}

function handleFileSelect() {
    const file = document.getElementById('csv-file').files[0];
    if (file) {
        document.getElementById('file-info').style.display = 'flex';
        document.getElementById('file-name').textContent = `📄 ${file.name} (${(file.size/1024).toFixed(1)}KB)`;
        document.getElementById('btn-bulk-upload').disabled = false;
    }
}

function clearFile() {
    document.getElementById('csv-file').value = '';
    document.getElementById('file-info').style.display = 'none';
    document.getElementById('btn-bulk-upload').disabled = true;
}

async function uploadBulk() {
    if (!state.selectedBlog) { showToast('error', '블로그를 먼저 선택하세요.'); return; }
    const file = document.getElementById('csv-file').files[0];
    if (!file) { showToast('error', 'CSV 파일을 선택하세요.'); return; }
    const btn = document.getElementById('btn-bulk-upload');
    btn.disabled = true; btn.textContent = '⏳ 업로드 중...';
    const formData = new FormData();
    formData.append('file', file);
    try {
        const res = await fetch(`/api/blogs/${state.selectedBlog}/bulk`, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success) {
            showToast('success', `총 ${data.total}개 중 ${data.success_count}개 발행 성공!`);
            renderBulkResults(data);
            loadPosts();
        } else {
            showToast('error', '대량 포스팅 실패: ' + data.error);
        }
    } catch (e) {
        showToast('error', '업로드 중 오류가 발생했습니다.');
    } finally {
        btn.disabled = false; btn.textContent = '📦 대량 포스팅 시작';
    }
}

function renderBulkResults(data) {
    const card = document.getElementById('bulk-results-card');
    const container = document.getElementById('bulk-results');
    card.style.display = 'block';
    container.innerHTML = `
        <p style="margin-bottom:16px;">총 <strong>${data.total}</strong>개 중 <strong style="color:var(--success)">${data.success_count}</strong>개 성공</p>
        ${data.results.map(r => `
            <div class="post-item">
                <div class="post-item-info">
                    <h4>${escapeHtml(r.title || '제목 없음')}</h4>
                    <p style="color:${r.success ? 'var(--success)' : 'var(--danger)'}">${r.success ? '✅ 성공' : '❌ 실패: ' + (r.error || '')}</p>
                </div>
            </div>
        `).join('')}
    `;
}

// ==================== 유틸리티 ====================
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function showToast(type, message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(100%)'; setTimeout(() => toast.remove(), 300); }, 4000);
}

// ==================== AI 설정 ====================
function openSettingsModal() {
    const key = localStorage.getItem('gemini_api_key');
    if (key) {
        document.getElementById('gemini-api-key').value = key;
    }
    document.getElementById('settings-modal').classList.add('active');
}

function saveSettings() {
    const key = document.getElementById('gemini-api-key').value.trim();
    if (key) {
        localStorage.setItem('gemini_api_key', key);
        showToast('success', 'AI 설정이 저장되었습니다.');
        closeModal('settings-modal');
    } else {
        showToast('error', 'API Key를 입력해주세요.');
    }
}

// ==================== AI 자동 포스팅 ====================
async function aiAutoPost(keyword) {
    if (!state.selectedBlog) {
        showToast('error', '블로그를 먼저 선택하세요.');
        return;
    }
    
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
        showToast('warning', 'AI(Gemini) API Key 설정이 필요합니다.');
        openSettingsModal();
        return;
    }

    if (!confirm(`"${keyword}" 주제로 AI가 자동으로 글을 작성하고 발행합니다.\n진행하시겠습니까?`)) return;

    const modal = document.getElementById('ai-loading-modal');
    modal.classList.add('active');

    try {
        const res = await fetch('/api/ai/generate_and_post', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                blog_id: state.selectedBlog, 
                keyword: keyword, 
                api_key: apiKey,
                is_draft: false
            })
        });
        
        const data = await res.json();
        if (data.success) {
            showToast('success', `AI 자동 발행 성공: ${data.post.title}`);
            loadPosts();
        } else {
            showToast('error', 'AI 발행 실패: ' + data.error);
        }
    } catch (e) {
        showToast('error', 'AI 발행 중 오류가 발생했습니다.');
    } finally {
        modal.classList.remove('active');
    }
}
