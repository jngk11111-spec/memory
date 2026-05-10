"""
Blogger API v3 래퍼 모듈
- Google OAuth2 인증
- 블로그 목록 조회
- 게시물 CRUD
- 대량 포스팅
"""

import os
import pickle
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from google.auth.transport.requests import Request

# 설정
CLIENT_SECRET_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'client_secrets.json.json')
TOKEN_PICKLE_FILE = os.path.join(os.path.dirname(__file__), 'token.pickle')
API_SERVICE_NAME = 'blogger'
API_VERSION = 'v3'
SCOPES = ['https://www.googleapis.com/auth/blogger']


def get_credentials():
    """저장된 인증 정보를 로드하거나 새로 인증합니다."""
    creds = None

    if os.path.exists(TOKEN_PICKLE_FILE):
        with open(TOKEN_PICKLE_FILE, 'rb') as token:
            creds = pickle.load(token)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRET_FILE, SCOPES)
            creds = flow.run_local_server(port=8090)
        # 토큰 저장
        with open(TOKEN_PICKLE_FILE, 'wb') as token:
            pickle.dump(creds, token)

    return creds


def get_service():
    """Blogger API 서비스 객체를 반환합니다."""
    creds = get_credentials()
    service = build(API_SERVICE_NAME, API_VERSION, credentials=creds)
    return service


def is_authenticated():
    """인증 상태를 확인합니다."""
    if not os.path.exists(TOKEN_PICKLE_FILE):
        return False
    try:
        with open(TOKEN_PICKLE_FILE, 'rb') as token:
            creds = pickle.load(token)
        return creds and creds.valid or (creds and creds.expired and creds.refresh_token)
    except Exception:
        return False


def list_blogs():
    """사용자의 블로그 목록을 반환합니다."""
    service = get_service()
    result = service.blogs().listByUser(userId='self').execute()
    blogs = result.get('items', [])
    return [
        {
            'id': blog['id'],
            'name': blog['name'],
            'url': blog['url'],
            'posts_count': blog.get('posts', {}).get('totalItems', 0)
        }
        for blog in blogs
    ]


def list_posts(blog_id, max_results=20):
    """특정 블로그의 게시물 목록을 반환합니다."""
    service = get_service()
    result = service.posts().list(
        blogId=blog_id,
        maxResults=max_results,
        orderBy='PUBLISHED',
        fetchBodies=False
    ).execute()
    posts = result.get('items', [])
    return [
        {
            'id': post['id'],
            'title': post['title'],
            'url': post['url'],
            'published': post['published'],
            'labels': post.get('labels', [])
        }
        for post in posts
    ]


def create_post(blog_id, title, content, labels=None, is_draft=False):
    """새 게시물을 작성합니다."""
    service = get_service()
    post_data = {
        'kind': 'blogger#post',
        'title': title,
        'content': content
    }
    if labels:
        post_data['labels'] = labels

    result = service.posts().insert(
        blogId=blog_id,
        body=post_data,
        isDraft=is_draft
    ).execute()

    return {
        'id': result['id'],
        'title': result['title'],
        'url': result.get('url', ''),
        'status': 'draft' if is_draft else 'published'
    }


def delete_post(blog_id, post_id):
    """게시물을 삭제합니다."""
    service = get_service()
    service.posts().delete(blogId=blog_id, postId=post_id).execute()
    return True


def bulk_create_posts(blog_id, posts_data):
    """
    여러 게시물을 한번에 작성합니다.
    posts_data: [{'title': '...', 'content': '...', 'labels': [...]}]
    """
    results = []
    for post in posts_data:
        try:
            result = create_post(
                blog_id=blog_id,
                title=post['title'],
                content=post['content'],
                labels=post.get('labels', []),
                is_draft=post.get('is_draft', False)
            )
            result['success'] = True
            results.append(result)
        except Exception as e:
            results.append({
                'title': post['title'],
                'success': False,
                'error': str(e)
            })
    return results


def logout():
    """인증 토큰을 삭제합니다."""
    if os.path.exists(TOKEN_PICKLE_FILE):
        os.remove(TOKEN_PICKLE_FILE)
        return True
    return False
