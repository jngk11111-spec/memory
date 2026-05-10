"""
Google Trends 트렌드 조회 모듈
- Google Trends RSS Feed를 활용하여 실시간 인기 검색어 조회
- 국가별 트렌드 지원
"""

import feedparser
from datetime import datetime

# 지원 국가 목록
COUNTRIES = {
    'KR': {'name': '한국', 'code': 'KR'},
    'US': {'name': '미국', 'code': 'US'},
    'JP': {'name': '일본', 'code': 'JP'},
    'GB': {'name': '영국', 'code': 'GB'},
    'DE': {'name': '독일', 'code': 'DE'},
    'FR': {'name': '프랑스', 'code': 'FR'},
    'BR': {'name': '브라질', 'code': 'BR'},
    'IN': {'name': '인도', 'code': 'IN'},
}

TRENDS_RSS_URL = "https://trends.google.com/trending/rss?geo={geo}"


def get_trending_searches(geo='KR'):
    """
    특정 국가의 실시간 인기 검색어를 가져옵니다.

    Args:
        geo: 국가 코드 (예: 'KR', 'US', 'JP')

    Returns:
        list: 트렌드 키워드 리스트
    """
    url = TRENDS_RSS_URL.format(geo=geo)
    feed = feedparser.parse(url)

    trends = []
    for entry in feed.entries:
        trend = {
            'title': entry.get('title', ''),
            'link': entry.get('link', ''),
            'published': entry.get('published', ''),
            'traffic': entry.get('ht_approx_traffic', ''),
            'description': _clean_description(entry.get('summary', '')),
            'news_items': _extract_news(entry),
        }
        trends.append(trend)

    return trends


def _clean_description(desc):
    """HTML 태그를 제거하고 깨끗한 텍스트를 반환합니다."""
    import re
    clean = re.sub(r'<[^>]+>', '', desc)
    return clean.strip()


def _extract_news(entry):
    """트렌드와 관련된 뉴스 항목을 추출합니다."""
    news = []
    # RSS의 ht:news_item 태그에서 뉴스 추출
    if hasattr(entry, 'ht_news_item_title'):
        news.append({
            'title': entry.get('ht_news_item_title', ''),
            'url': entry.get('ht_news_item_url', ''),
            'source': entry.get('ht_news_item_source', ''),
        })

    # 여러 뉴스 아이템이 있는 경우 파싱
    raw = entry.get('summary', '')
    if '<a href=' in raw:
        import re
        links = re.findall(r'<a href="([^"]+)"[^>]*>([^<]+)</a>', raw)
        for url, title in links:
            if title.strip() and url.startswith('http'):
                news.append({
                    'title': title.strip(),
                    'url': url,
                    'source': '',
                })

    return news


def get_countries():
    """지원하는 국가 목록을 반환합니다."""
    return COUNTRIES


def get_trend_summary(geo='KR', limit=10):
    """
    간단한 트렌드 요약을 반환합니다.

    Args:
        geo: 국가 코드
        limit: 최대 개수

    Returns:
        list: 트렌드 요약 리스트
    """
    trends = get_trending_searches(geo)
    return trends[:limit]
