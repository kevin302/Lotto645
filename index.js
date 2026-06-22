const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/api/lotto', async (req, res) => {
    try {
        let drwNo = req.query.drwNo;

        // 1. 회차가 없을 경우 자동으로 최신 회차 분석하여 가져오기
        if (!drwNo) {
            const mainPageResponse = await axios.get('https://dhlottery.co.kr/gameResult.do?method=byWin', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
                }
            });
            const htmlText = mainPageResponse.data;
            const match = htmlText.match(/정기공시\s*<strong>(\d+)회<\/strong>/) || htmlText.match(/<h4>(\d+)회\s*당첨결과<\/h4>/);
            if (match && match[1]) {
                drwNo = match[1];
            } else {
                drwNo = '1100'; // 정규식 매칭 실패 시 임시 기본값
            }
        }

        // 2. 위장 헤더를 들고 동행복권 공식 API 호출하기
        const lottoUrl = `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${drwNo}`;
        const response = await axios.get(lottoUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.dhlottery.co.kr/',
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        // 3. 만약 방화벽에 걸려 HTML이 반환되었다면 에러 처리
        if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE')) {
            return res.status(403).json({
                returnValue: "fail",
                error: "동행복권 서버 방화벽에 의해 요청이 차단되었습니다. (위장 실패)"
            });
        }

        // 4. 정상적인 JSON 결과 반환
        res.json(response.data);

    } catch (error) {
        res.status(500).json({
            returnValue: "fail",
            error: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});