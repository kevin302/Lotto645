const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// 동행복권 방화벽을 통과하기 위한 최신 브라우저 위장 헤더 
const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://dhlottery.co.kr/lt645/result.do',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    'X-Requested-With': 'XMLHttpRequest'
};

// CORS 허용 설정 (유니티 및 웹 브라우저 접근 허용)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// 최신 회차 번호를 동행복권 HTML에서 실시간으로 파싱하는 함수
async function getLatestDrawNumber() {
    try {
        const response = await axios.get('https://dhlottery.co.kr/lt645/result.do', {
            headers: { 'User-Agent': BROWSER_HEADERS['User-Agent'] }
        });
        
        // HTML 소스에서 현재 회차 텍스트(예: <strong>1100회</strong>)를 추출하는 정규표현식
        const match = response.data.match(/<strong>(\d+)회<\/strong>/);
        if (match && match[1]) {
            return parseInt(match[1], 10);
        }
        
        // 크롤링 실패 시 기준일 기반으로 안전하게 계산 (1회차: 2002년 12월 7일) [cite: 51]
        const firstDrawDate = new Date('2002-12-07T21:00:00+09:00');
        const currentDate = new Date();
        const diffWeeks = Math.floor((currentDate - firstDrawDate) / (1000 * 60 * 60 * 24 * 7));
        return diffWeeks + 1;
    } catch (error) {
        return 1100; // 최악의 경우 폴백용 기본값
    }
}

// 로또 당첨 정보 API 엔드포인트
app.get('/api/lotto', async (req, res) => {
    let drwNo = req.query.drwNo;

    try {
        // 1. 회차 번호가 없을 경우 자동으로 최신 회차 조회
        if (!drwNo) {
            drwNo = await getLatestDrawNumber();
        }

        // 2. 동행복권 오리지널 API 호출 [cite: 443]
        const targetUrl = `https://dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${drwNo}`;
        const response = await axios.get(targetUrl, { headers: BROWSER_HEADERS });

        // 3. 만약 서버가 차단하여 JSON이 아닌 HTML을 보냈을 때의 예외 처리 [cite: 318, 741]
        if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE')) {
            return res.status(500).json({
                returnValue: "fail",
                error: "동행복권 서버 방화벽에 의해 요청이 차단되었습니다. (HTML 반환됨)"
            });
        }

        // 4. 정상적인 결과 반환
        res.json(response.data);

    } catch (error) {
        res.status(500).json({
            returnValue: "fail",
            error: error.message
        });
    }
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`Lotto API Server is running on port ${PORT}`);
});