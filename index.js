const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.post('/api/music', async (req, res) => {
    try {
        // 카카오톡 유저가 보낸 메시지
        const userMessage = req.body.userRequest?.utterance || '';
        
        // [정규식] 1. 유튜브(PC/모바일), 2. 스포티파이(국가코드 포함) 완벽 매칭
        const youtubeRegex = /(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11}))/;
        const spotifyRegex = /(https?:\/\/open\.spotify\.com\/(?:[a-zA-Z]{2,4}-[a-zA-Z]{2,4}\/)?track\/([A-Za-z0-9]+))/;

        const youtubeMatch = userMessage.match(youtubeRegex);
        const spotifyMatch = userMessage.match(spotifyRegex);

        let cleanUrl = '';
        let targetPlatform = '';

        if (youtubeMatch) {
            // ?si= 등 군더더기를 떼고 표준 PC 주소 포맷으로 강제 통일
            cleanUrl = `https://www.youtube.com/watch?v=${youtubeMatch[2]}`;
            targetPlatform = 'youtube';
        } else if (spotifyMatch) {
            // intl-ko 등 국가코드를 무시하고 표준 스포티파이 주소로 강제 통일
            cleanUrl = `https://open.spotify.com/track/${spotifyMatch[2]}`;
            targetPlatform = 'spotify';
        }

        // 링크가 없으면 아무 반응 없이 종료 (일반 대화 시 침묵)
        if (!cleanUrl) {
            return res.json({ version: "2.0", template: { outputs: [] } });
        }

        // Odesli (song.link) 오픈 API 호출
        const apiUrl = `https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(cleanUrl)}&userCountry=KR`;
        const response = await axios.get(apiUrl);
        
        let resultMessage = '';

        // API 응답 데이터 구조에 맞춰 안전하게 링크 추출
        if (targetPlatform === 'youtube') {
            const spotifyLink = response.data.linksByPlatform?.spotify?.url;
            resultMessage = spotifyLink 
                ? `🎵 스포티파이 변환 링크입니다:\n${spotifyLink}`
                : `❌ 이 영상에 매칭되는 스포티파이 음원을 찾지 못했습니다.`;
        } else if (targetPlatform === 'spotify') {
            const youtubeLink = response.data.linksByPlatform?.youtube?.url;
            resultMessage = youtubeLink 
                ? `🎵 유튜브 변환 링크입니다:\n${youtubeLink}`
                : `❌ 이 음원에 매칭되는 유튜브 영상을 찾지 못했습니다.`;
        }

        // 카카오톡에 답변 전송
        return res.json({
            version: "2.0",
            template: {
                outputs: [
                    {
                        simpleText: {
                            text: resultMessage
                        }
                    }
                ]
            }
        });

    } catch (error) {
        console.error('변환 에러 상세:', error.response?.data || error.message);
        // 에러 발생 시에도 방 분위기를 깨지 않도록 조용히 응답 없음 처리하거나 안내
        return res.json({
            version: "2.0",
            template: {
                outputs: [
                    {
                        simpleText: {
                            text: "⚠️ 링크를 변환하는 과정에서 일시적인 오류가 발생했습니다."
                        }
                    }
                ]
            }
        });
    }
});

app.listen(PORT, () => {
    console.log(`서버가 포트 ${PORT}에서 정상 작동 중입니다.`);
});
