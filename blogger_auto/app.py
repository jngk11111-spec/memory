"""
블로그스팟 자동 포스팅 프로그램 - Flask 메인 앱
"""

import os
import csv
import io
from flask import Flask, render_template, request, jsonify, redirect, url_for
from blogger_api import (
    is_authenticated, get_credentials, list_blogs, list_posts,
    create_post, delete_post, bulk_create_posts, logout
)
from trends import get_trending_searches, get_countries, get_trend_summary
from ai_writer import generate_blog_post

app = Flask(__name__)
app.secret_key = os.urandom(24)


@app.route('/')
def index():
    """메인 페이지"""
    return render_template('index.html')


# ==================== 인증 API ====================

@app.route('/api/auth/status')
def auth_status():
    """인증 상태 확인"""
    return jsonify({'authenticated': is_authenticated()})


@app.route('/api/auth/login', methods=['POST'])
def auth_login():
    """Google OAuth 로그인"""
    try:
        get_credentials()
        return jsonify({'success': True, 'message': '로그인 성공!'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/auth/logout', methods=['POST'])
def auth_logout():
    """로그아웃"""
    logout()
    return jsonify({'success': True, 'message': '로그아웃 완료'})


# ==================== 블로그 API ====================

@app.route('/api/blogs')
def api_list_blogs():
    """블로그 목록 조회"""
    try:
        blogs = list_blogs()
        return jsonify({'success': True, 'blogs': blogs})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/blogs/<blog_id>/posts')
def api_list_posts(blog_id):
    """게시물 목록 조회"""
    try:
        max_results = request.args.get('max', 20, type=int)
        posts = list_posts(blog_id, max_results=max_results)
        return jsonify({'success': True, 'posts': posts})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/blogs/<blog_id>/posts', methods=['POST'])
def api_create_post(blog_id):
    """새 게시물 작성"""
    try:
        data = request.get_json()
        title = data.get('title', '')
        content = data.get('content', '')
        labels = data.get('labels', [])
        is_draft = data.get('is_draft', False)

        if not title or not content:
            return jsonify({'success': False, 'error': '제목과 내용을 입력해주세요.'}), 400

        result = create_post(blog_id, title, content, labels, is_draft)
        return jsonify({'success': True, 'post': result})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/blogs/<blog_id>/posts/<post_id>', methods=['DELETE'])
def api_delete_post(blog_id, post_id):
    """게시물 삭제"""
    try:
        delete_post(blog_id, post_id)
        return jsonify({'success': True, 'message': '삭제 완료'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/blogs/<blog_id>/bulk', methods=['POST'])
def api_bulk_post(blog_id):
    """대량 포스팅 (CSV)"""
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'CSV 파일을 업로드해주세요.'}), 400

        file = request.files['file']
        if not file.filename.endswith('.csv'):
            return jsonify({'success': False, 'error': 'CSV 파일만 지원합니다.'}), 400

        # CSV 파싱
        stream = io.StringIO(file.stream.read().decode('utf-8-sig'))
        reader = csv.DictReader(stream)

        posts_data = []
        for row in reader:
            post = {
                'title': row.get('title', row.get('제목', '')),
                'content': row.get('content', row.get('내용', '')),
                'labels': [l.strip() for l in row.get('labels', row.get('라벨', '')).split(',') if l.strip()],
                'is_draft': row.get('draft', row.get('임시저장', 'false')).lower() == 'true'
            }
            if post['title'] and post['content']:
                posts_data.append(post)

        if not posts_data:
            return jsonify({'success': False, 'error': 'CSV에서 유효한 게시물을 찾을 수 없습니다.'}), 400

        results = bulk_create_posts(blog_id, posts_data)
        success_count = sum(1 for r in results if r.get('success'))
        return jsonify({
            'success': True,
            'total': len(results),
            'success_count': success_count,
            'results': results
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ==================== AI API ====================

@app.route('/api/ai/generate_and_post', methods=['POST'])
def api_ai_generate_and_post():
    """AI를 활용해 글을 생성하고 발행합니다."""
    try:
        data = request.get_json()
        blog_id = data.get('blog_id')
        keyword = data.get('keyword')
        api_key = data.get('api_key')
        is_draft = data.get('is_draft', False)

        if not blog_id or not keyword or not api_key:
            return jsonify({'success': False, 'error': 'blog_id, keyword, api_key가 모두 필요합니다.'}), 400

        # 1. AI 글 생성
        ai_result = generate_blog_post(api_key, keyword)
        
        # 2. Blogger 포스팅
        post_result = create_post(
            blog_id=blog_id,
            title=ai_result['title'],
            content=ai_result['content'],
            labels=ai_result.get('labels', []),
            is_draft=is_draft
        )
        
        return jsonify({
            'success': True,
            'message': 'AI 포스팅이 완료되었습니다.',
            'post': post_result
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ==================== 트렌드 API ====================

@app.route('/api/trends')
def api_trends():
    """트렌드 조회"""
    try:
        geo = request.args.get('geo', 'KR')
        limit = request.args.get('limit', 20, type=int)
        trends = get_trend_summary(geo, limit)
        return jsonify({'success': True, 'trends': trends, 'geo': geo})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/trends/countries')
def api_countries():
    """지원 국가 목록"""
    countries = get_countries()
    return jsonify({'success': True, 'countries': countries})


if __name__ == '__main__':
    print("\n" + "=" * 50)
    print("  BlogBot - Blogger Auto Posting")
    print("  http://localhost:5000")
    print("=" * 50 + "\n")
    app.run(debug=True, port=5000)
