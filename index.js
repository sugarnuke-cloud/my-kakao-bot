const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// 카카오 i 오픈빌더는 JSON 형식으로 데이터를 주고받으므로 필수 설정입니다.
app.use(express.json());

app.post('/api/music', async (req, res) => {
    try {
        // 카카오톡 유저가 보낸 메시지 추출
        const userMessage = req.body.userRequest?.utterance || '';
        
        // 1. 유튜브와 스포티파이 링크를 찾아내는 정규식 (뒤쪽 잡다한 파라미터 제외하고 순수 ID만 추출)
        const youtubeRegex = /(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11}))/;
        const spotifyRegex = /(https?:\/\/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?track\/([A-Za-z0-9]+))/;

        const youtubeMatch = userMessage.match(youtubeRegex);
        const spotifyMatch = userMessage.match(spotifyRegex);

        let cleanUrl = '';
        let targetPlatform = '';

        if (youtubeMatch) {
            // ?si=... 등을 제외한 순수한 유튜브 표준 주소 재조립
            cleanUrl = `https://www.youtube.com/watch?v=${youtubeMatch[2]}`;
            targetPlatform = 'youtube';
        } else if (spotifyMatch) {
            // ?si=... 등을 제외한 순수한 스포티파이 주소 재조립
            cleanUrl = `https://open.spotify.com/track/${spotifyMatch[2]}`;
            targetPlatform = 'spotify';
        }

        // 링크가 없으면 아무런 대답도 하지 않고 종료 (방을 조용하게 유지)
        if (!cleanUrl) {
            return res.json({ version: "2.0", template: { outputs: [] } });
        }

        // 2. 외부 변환 API 호출 (예시 주소이므로 본인의 실제 API 엔드포인트가 있다면 거기를 적으셔야 합니다)
        // 여기서는 예시로 많이 쓰이는 음악 변환 허브 구조를 가정합니다.
        const response = await axios.get(`https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(cleanUrl)}`);
        
        // API 결과에서 변환된 상대 플랫폼 주소 추출
        let resultMessage = '';
        if (targetPlatform === 'youtube') {
            const spotifyLink = response.data.linksByPlatform?.spotify?.url;
            resultMessage = spotifyLink 
                ? `🎵 스포티파이 변환 링크입니다:\n${spotifyLink}`
                : `❌ 이 영상에 매칭되는 스포티파이 음원을 찾지 못했습니다.`;
        } else {
            const youtubeLink = response.data.linksByPlatform?.youtube?.url;
            resultMessage = youtubeLink 
                ? `🎵 유튜브 변환 링크입니다:\n${youtubeLink}`
                : `❌ 이 음원에 매칭되는 유튜브 영상을 찾지 못했습니다.`;
        }

        // 3. 카카오톡으로 결과 말풍선 전송
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
        console.error('서버 에러 발생:', error.message);
        // 에러가 나더라도 방이 지저분해지지 않게 조용히 처리하거나 에러 메시지 전송
        return res.json({
            version: "2.0",
            template: {
                outputs: [
                    {
                        simpleText: {
                            text: "⚠️ 링크를 변환하는 도중 에러가 발생했습니다."
                        }
                    }
                ]
            }
        });
    }
});

app.listen(PORT, () => {
    console.log(`카카오 음악 봇 서버가 포트 ${PORT}에서 작동 중입니다.`);
});
