"""
AI Writer 모듈
- Google Gemini API를 활용한 블로그 포스팅 자동 생성
"""

import google.generativeai as genai
import json

def generate_blog_post(api_key, keyword, language="ko"):
    """
    주어진 키워드로 블로그 포스팅을 생성합니다.
    
    Args:
        api_key (str): Gemini API Key
        keyword (str): 주제 키워드
        language (str): 언어 (기본: ko)
        
    Returns:
        dict: {'title': '...', 'content': '...', 'labels': ['...', '...']}
    """
    if not api_key:
        raise ValueError("API 키가 필요합니다.")
        
    genai.configure(api_key=api_key)
    
    # 모델 설정
    model = genai.GenerativeModel('gemini-2.5-flash')
    
    prompt = f"""
    당신은 전문적인 블로거이자 SEO 전문가입니다. 
    다음 키워드에 대한 매력적이고 정보가 풍부한 블로그 포스팅을 작성해 주세요.
    
    키워드: "{keyword}"
    언어: {language}
    
    요구사항:
    1. 제목(title): 클릭을 유도할 수 있는 매력적인 제목.
    2. 내용(content): 
       - 서론, 본론, 결론의 구조를 갖출 것.
       - HTML 태그를 적절히 사용하여 가독성을 높일 것 (<h1>, <h2>, <p>, <ul>, <li>, <strong> 등).
       - 글 길이는 최소 800자 이상으로 상세하게 작성할 것.
       - SEO를 고려하여 키워드를 자연스럽게 포함시킬 것.
       - 절대로 마크다운(```html) 형식의 코드 블록으로 감싸지 말고 순수 HTML 문자열만 반환할 것.
    3. 라벨(labels): 포스팅과 관련된 태그 3~5개를 문자열 리스트로 반환.
    
    출력 형식:
    반드시 다음 형식의 유효한 JSON 객체로만 응답하세요. 다른 설명은 추가하지 마세요.
    {{
        "title": "여기에 제목",
        "content": "여기에 HTML 내용",
        "labels": ["태그1", "태그2", "태그3"]
    }}
    """
    
    try:
        response = model.generate_content(prompt)
        text = response.text.strip()
        
        # Markdown 코드 블록 제거 (혹시 포함되었을 경우)
        if text.startswith('```json'):
            text = text[7:]
        elif text.startswith('```'):
            text = text[3:]
        if text.endswith('```'):
            text = text[:-3]
            
        text = text.strip()
        
        result = json.loads(text)
        return result
    except json.JSONDecodeError as e:
        raise Exception("AI 응답을 파싱하는 중 오류가 발생했습니다. 다시 시도해 주세요.") from e
    except Exception as e:
        raise Exception(f"AI 글 생성 실패: {str(e)}")
