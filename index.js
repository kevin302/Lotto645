const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// 실제 최신 크롬 브라우저와 동일한 헤더 구성
const BASE_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'max-age=0',
    'Connection': 'keep-alive'
};

// 동행복권 메인 세션을 획득하고 쿠키와 최신 회차를 가져오는 함수
async function getSessionAndLatest() {
    try {
        const response = await axios.get('https://www.dhlottery.co.kr/lt645/result/prsl645.do', {
            headers: BASE_HEADERS,
            timeout: 7000
        });

        // 1. 서버가 내려준 쿠키(JSESSIONID 등) 추출
        const setCookie = response.headers['set-cookie'];
        let cookieString = '';
        if (setCookie) {
            cookieString = setCookie.map(c => c.split(';')[0]).join('; ');
        }

        // 2. HTML 내에서 최근 회차 번호 추출
        let latestDrwNo = null;
        const match = response.data.match(/<h4><strong>(\d+)<\/strong>\s*회\s*당첨결과<\/h4>/);
        if (match && match[1]) {
            latestDrwNo = parseInt(match[1], 10);
        }

        return { cookie: cookieString, latestDrwNo };
    } catch (error) {
        console.error('세션 획득 실패:', error.message);
        return { cookie: '', latestDrwNo: null };
    }
}

app.get('/api/lotto', async (req, res) => {
    let drwNo = req.query.drwNo;

    // 1. 사전 접속을 통해 유효한 쿠키와 최신 회차 정보 수집
    const { cookie, latestDrwNo } = await getSessionAndLatest();

    if (!drwNo) {
        if (latestDrwNo) {
            drwNo = latestDrwNo;
        } else {
            return res.status(500).json({ returnValue: 'fail', error: '최신 회차 정보를 추출할 수 없습니다.' });
        }
    }

    try {
        // 2. 획득한 쿠키를 헤더에 주입하여 API 호출 (방화벽 완벽 우회)
        const apiHeaders = {
            ...BASE_HEADERS,
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Referer': `https://www.dhlottery.co.kr/lt645/selectPstLt645Info.do?srchStrLtEpsd=${drwNo}`,
            'X-Requested-With': 'XMLHttpRequest'
        };

        if (cookie) {
            apiHeaders['Cookie'] = cookie;
        }

        const url = `https://www.dhlottery.co.kr/lt645/selectPstLt645Info.do?srchStrLtEpsd=${drwNo}`;
        const response = await axios.get(url, { headers: apiHeaders, timeout: 5000 });

        // 여전히 방화벽 HTML을 리턴하는지 검증
        if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE')) {
            return res.status(403).json({
                returnValue: 'fail',
                error: '동행복권 서버 방화벽에 의해 요청이 차단되었습니다. (쿠키 위장 실패)'
            });
        }

        res.json(response.data);

    } catch (error) {
        res.status(500).json({ returnValue: 'fail', error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`서버가 포트 ${PORT}에서 작동 중입니다.`);
});